//! Block templates to stratum jobs, and checking what miners send back.
//! Byte orders follow what AxeOS and AxeForge do on the miner side:
//! prevhash is the header's prevhash with each 4-byte word swapped, merkle
//! branches are in header (internal) order, version/nbits/ntime are
//! big-endian hex of the u32.

use serde_json::Value;
use sha2::{Digest, Sha256};

pub type H256 = [u8; 32];

pub fn sha256d(b: &[u8]) -> H256 {
    Sha256::digest(Sha256::digest(b)).into()
}

fn swap_words(b: &H256) -> H256 {
    let mut o = [0u8; 32];
    for i in (0..32).step_by(4) {
        for j in 0..4 {
            o[i + j] = b[i + 3 - j];
        }
    }
    o
}

/// Display hex (as RPC prints hashes) to header byte order.
fn from_display(s: &str) -> Result<H256, String> {
    let mut v = hex::decode(s).map_err(|_| format!("bad hash {s}"))?;
    if v.len() != 32 {
        return Err(format!("bad hash {s}"));
    }
    v.reverse();
    Ok(v.try_into().unwrap())
}

pub fn display(h: &H256) -> String {
    let mut v = *h;
    v.reverse();
    hex::encode(v)
}

/// nbits to a big-endian 256-bit target.
pub fn bits_to_target(bits: u32) -> H256 {
    let exp = (bits >> 24) as usize;
    let mant = bits & 0x007f_ffff;
    let mut t = [0u8; 32];
    let m = [(mant >> 16) as u8, (mant >> 8) as u8, mant as u8];
    for (i, b) in m.iter().enumerate() {
        // byte i of the mantissa lands at position (32 - exp + i)
        let pos = 32i64 - exp as i64 + i as i64;
        if (0..32).contains(&pos) {
            t[pos as usize] = *b;
        }
    }
    t
}

const DIFF1: f64 = 26959535291011309493156476344723991336010898738574164086137773096960.0; // 0xffff * 2^208

/// Big-endian 256-bit number as f64.
fn be_f64(b: &H256) -> f64 {
    b.iter().fold(0.0, |acc, &x| acc * 256.0 + x as f64)
}

/// Difficulty of a header hash (the hash as sha256d returns it).
pub fn hash_diff(hash: &H256) -> f64 {
    let mut be = *hash;
    be.reverse();
    let v = be_f64(&be);
    if v == 0.0 {
        f64::INFINITY
    } else {
        DIFF1 / v
    }
}

pub fn target_diff(target: &H256) -> f64 {
    let v = be_f64(target);
    if v == 0.0 {
        0.0
    } else {
        DIFF1 / v
    }
}

fn varint(n: u64, out: &mut Vec<u8>) {
    match n {
        0..=0xfc => out.push(n as u8),
        0xfd..=0xffff => {
            out.push(0xfd);
            out.extend_from_slice(&(n as u16).to_le_bytes());
        }
        0x1_0000..=0xffff_ffff => {
            out.push(0xfe);
            out.extend_from_slice(&(n as u32).to_le_bytes());
        }
        _ => {
            out.push(0xff);
            out.extend_from_slice(&n.to_le_bytes());
        }
    }
}

/// BIP34 height, encoded the way bitcoind's `CScript() << height` does.
fn height_push(h: u64) -> Vec<u8> {
    if h == 0 {
        return vec![0x00];
    }
    if h <= 16 {
        return vec![0x50 + h as u8];
    }
    let mut v = Vec::new();
    let mut x = h;
    while x > 0 {
        v.push((x & 0xff) as u8);
        x >>= 8;
    }
    if v.last().unwrap() & 0x80 != 0 {
        v.push(0);
    }
    let mut out = vec![v.len() as u8];
    out.extend(v);
    out
}

#[derive(Debug, Clone)]
pub struct Template {
    pub height: u64,
    pub version: u32,
    /// header byte order
    pub prev: H256,
    pub prev_display: String,
    pub bits: u32,
    pub curtime: u32,
    pub mintime: u32,
    pub coinbase_value: u64,
    pub witness_commitment: Option<Vec<u8>>,
    pub txids: Vec<H256>,
    pub txdata: Vec<String>,
    pub fees: u64,
    /// big-endian
    pub target: H256,
}

impl Template {
    pub fn from_gbt(v: &Value) -> Result<Template, String> {
        let s = |k: &str| v.get(k).and_then(|x| x.as_str()).ok_or(format!("template has no {k}"));
        let n = |k: &str| v.get(k).and_then(|x| x.as_u64()).ok_or(format!("template has no {k}"));
        let prev_display = s("previousblockhash")?.to_string();
        let bits = u32::from_str_radix(s("bits")?, 16).map_err(|_| "bad bits")?;
        let mut txids = Vec::new();
        let mut txdata = Vec::new();
        let mut fees = 0;
        for t in v.get("transactions").and_then(|x| x.as_array()).cloned().unwrap_or_default() {
            let id = t.get("txid").and_then(|x| x.as_str()).ok_or("tx without txid")?;
            txids.push(from_display(id)?);
            txdata.push(t.get("data").and_then(|x| x.as_str()).ok_or("tx without data")?.to_string());
            fees += t.get("fee").and_then(|x| x.as_u64()).unwrap_or(0);
        }
        let witness_commitment = match v.get("default_witness_commitment").and_then(|x| x.as_str()) {
            Some(h) => Some(hex::decode(h).map_err(|_| "bad witness commitment")?),
            None => None,
        };
        let target = match v.get("target").and_then(|x| x.as_str()) {
            Some(t) => {
                let b = hex::decode(t).map_err(|_| "bad target")?;
                b.try_into().map_err(|_| "bad target")?
            }
            None => bits_to_target(bits),
        };
        Ok(Template {
            height: n("height")?,
            version: n("version")? as u32,
            prev: from_display(&prev_display)?,
            prev_display,
            bits,
            curtime: n("curtime")? as u32,
            mintime: v.get("mintime").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
            coinbase_value: n("coinbasevalue")?,
            witness_commitment,
            txids,
            txdata,
            fees,
            target,
        })
    }

    pub fn network_diff(&self) -> f64 {
        target_diff(&bits_to_target(self.bits))
    }
}

/// Sibling hashes along the coinbase's path to the merkle root.
pub fn merkle_steps(txids: &[H256]) -> Vec<H256> {
    let mut steps = Vec::new();
    let mut level: Vec<Option<H256>> = std::iter::once(None).chain(txids.iter().copied().map(Some)).collect();
    while level.len() > 1 {
        steps.push(level[1].unwrap());
        if level.len() % 2 == 1 {
            level.push(*level.last().unwrap());
        }
        let mut next = vec![None];
        for pair in level[2..].chunks(2) {
            let mut b = [0u8; 64];
            b[..32].copy_from_slice(&pair[0].unwrap());
            b[32..].copy_from_slice(&pair[1].unwrap());
            next.push(Some(sha256d(&b)));
        }
        level = next;
    }
    steps
}

pub fn merkle_root(coinbase_hash: H256, steps: &[H256]) -> H256 {
    let mut h = coinbase_hash;
    for s in steps {
        let mut b = [0u8; 64];
        b[..32].copy_from_slice(&h);
        b[32..].copy_from_slice(s);
        h = sha256d(&b);
    }
    h
}

/// Coinbase split around the extranonces: coinb1 + en1 + en2 + coinb2.
pub fn coinbase_parts(t: &Template, payout: &[u8], tag: &str, extranonce_len: usize) -> (Vec<u8>, Vec<u8>) {
    let mut tag = tag.as_bytes().to_vec();
    let height = height_push(t.height);
    // scriptSig is capped at 100 bytes
    let room = 100usize.saturating_sub(height.len() + 2 + extranonce_len);
    tag.truncate(room.min(75));
    let script_len = height.len() + 1 + tag.len() + 1 + extranonce_len;

    let mut c1 = Vec::with_capacity(64 + tag.len());
    c1.extend_from_slice(&1u32.to_le_bytes());
    c1.push(1);
    c1.extend_from_slice(&[0u8; 32]);
    c1.extend_from_slice(&0xffff_ffffu32.to_le_bytes());
    varint(script_len as u64, &mut c1);
    c1.extend_from_slice(&height);
    c1.push(tag.len() as u8);
    c1.extend_from_slice(&tag);
    c1.push(extranonce_len as u8);

    let mut c2 = Vec::with_capacity(96);
    c2.extend_from_slice(&0xffff_ffffu32.to_le_bytes());
    let outs = 1 + t.witness_commitment.is_some() as u64;
    varint(outs, &mut c2);
    c2.extend_from_slice(&t.coinbase_value.to_le_bytes());
    varint(payout.len() as u64, &mut c2);
    c2.extend_from_slice(payout);
    if let Some(wc) = &t.witness_commitment {
        c2.extend_from_slice(&0u64.to_le_bytes());
        varint(wc.len() as u64, &mut c2);
        c2.extend_from_slice(wc);
    }
    c2.extend_from_slice(&0u32.to_le_bytes());
    (c1, c2)
}

/// The fields a `mining.notify` carries for this template and coinbase.
pub fn notify_params(job_id: &str, t: &Template, steps: &[H256], c1: &[u8], c2: &[u8], clean: bool) -> Value {
    serde_json::json!([
        job_id,
        hex::encode(swap_words(&t.prev)),
        hex::encode(c1),
        hex::encode(c2),
        steps.iter().map(hex::encode).collect::<Vec<_>>(),
        format!("{:08x}", t.version),
        format!("{:08x}", t.bits),
        format!("{:08x}", t.curtime),
        clean,
    ])
}

pub fn header(t: &Template, root: &H256, version: u32, ntime: u32, nonce: u32) -> [u8; 80] {
    let mut h = [0u8; 80];
    h[0..4].copy_from_slice(&version.to_le_bytes());
    h[4..36].copy_from_slice(&t.prev);
    h[36..68].copy_from_slice(root);
    h[68..72].copy_from_slice(&ntime.to_le_bytes());
    h[72..76].copy_from_slice(&t.bits.to_le_bytes());
    h[76..80].copy_from_slice(&nonce.to_le_bytes());
    h
}

pub struct Checked {
    pub hash: H256,
    pub diff: f64,
    pub is_block: bool,
    pub header: [u8; 80],
    pub coinbase: Vec<u8>,
}

/// Rebuilds the header a miner hashed and scores it.
pub fn check(t: &Template, steps: &[H256], coinbase: Vec<u8>, version: u32, ntime: u32, nonce: u32) -> Checked {
    let root = merkle_root(sha256d(&coinbase), steps);
    let header = header(t, &root, version, ntime, nonce);
    let hash = sha256d(&header);
    let mut be = hash;
    be.reverse();
    Checked { hash, diff: hash_diff(&hash), is_block: be <= t.target, header, coinbase }
}

/// Full block for `submitblock`.
pub fn block_hex(t: &Template, c: &Checked) -> String {
    let mut b = Vec::with_capacity(1024);
    b.extend_from_slice(&c.header);
    varint(t.txids.len() as u64 + 1, &mut b);
    let cb = &c.coinbase;
    if t.witness_commitment.is_some() {
        // segwit coinbase: marker, flag, and the 32 zero bytes witness reserved value
        b.extend_from_slice(&cb[..4]);
        b.extend_from_slice(&[0x00, 0x01]);
        b.extend_from_slice(&cb[4..cb.len() - 4]);
        b.push(1);
        b.push(32);
        b.extend_from_slice(&[0u8; 32]);
        b.extend_from_slice(&cb[cb.len() - 4..]);
    } else {
        b.extend_from_slice(cb);
    }
    let mut s = hex::encode(b);
    for d in &t.txdata {
        s.push_str(d);
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hx(s: &str) -> Vec<u8> {
        hex::decode(s).unwrap()
    }

    #[test]
    fn block_125552_header() {
        // the worked example from the Bitcoin wiki
        let t = Template {
            height: 125552,
            version: 1,
            prev: from_display("00000000000008a3a41b85b8b29ad444def299fee21793cd8b9e567eab02cd81").unwrap(),
            prev_display: String::new(),
            bits: 0x1a44b9f2,
            curtime: 1305998791,
            mintime: 0,
            coinbase_value: 0,
            witness_commitment: None,
            txids: vec![],
            txdata: vec![],
            fees: 0,
            target: bits_to_target(0x1a44b9f2),
        };
        let root = from_display("2b12fcf1b09288fcaff797d71e950e71ae42b91e8bdb2304758dfcffc2b620e3").unwrap();
        let h = header(&t, &root, 1, 1305998791, 2504433986);
        let hash = sha256d(&h);
        assert_eq!(display(&hash), "00000000000000001e8d6829a8a21adc5d38d0a473b144b6765798e61f98bd1d");
        let mut be = hash;
        be.reverse();
        assert!(be <= t.target);
        assert!((t.network_diff() - 244112.49).abs() < 1.0);
    }

    #[test]
    fn steps_match_full_tree() {
        for n in 0..12usize {
            let txids: Vec<H256> = (0..n).map(|i| sha256d(&[i as u8])).collect();
            let cb = sha256d(b"coinbase");
            // naive full tree
            let mut level: Vec<H256> = std::iter::once(cb).chain(txids.iter().copied()).collect();
            while level.len() > 1 {
                if level.len() % 2 == 1 {
                    level.push(*level.last().unwrap());
                }
                level = level
                    .chunks(2)
                    .map(|p| {
                        let mut b = [0u8; 64];
                        b[..32].copy_from_slice(&p[0]);
                        b[32..].copy_from_slice(&p[1]);
                        sha256d(&b)
                    })
                    .collect();
            }
            assert_eq!(merkle_root(cb, &merkle_steps(&txids)), level[0], "n={n}");
        }
    }

    #[test]
    fn heights() {
        assert_eq!(height_push(1), vec![0x51]);
        assert_eq!(height_push(17), vec![1, 17]);
        assert_eq!(height_push(128), vec![2, 0x80, 0]);
        assert_eq!(height_push(840_000), vec![3, 0x40, 0xd1, 0x0c]);
    }

    fn sample() -> Template {
        let v = serde_json::json!({
            "version": 0x20000000u32,
            "previousblockhash": "00000000000000000001b2a3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7",
            "transactions": [
                {"txid": "aa".repeat(32), "data": "01", "fee": 1000},
                {"txid": "bb".repeat(32), "data": "02", "fee": 2000},
            ],
            "coinbasevalue": 312_503_000u64,
            "bits": "207fffff",
            "height": 900_000,
            "curtime": 1_760_000_000u32,
            "mintime": 1_759_999_000u32,
            "default_witness_commitment": "6a24aa21a9ed".to_string() + &"11".repeat(32),
        });
        Template::from_gbt(&v).unwrap()
    }

    /// Plays the miner: parses the notify strings the way AxeOS/AxeForge do,
    /// grinds a nonce, and checks the pool scores the same hash.
    #[test]
    fn miner_roundtrip() {
        let t = sample();
        assert_eq!(t.fees, 3000);
        let steps = merkle_steps(&t.txids);
        let payout = crate::pool::addr::script_for("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", crate::pool::addr::Net::Main).unwrap();
        let (c1, c2) = coinbase_parts(&t, &payout, "AxePool", 12);
        let p = notify_params("1", &t, &steps, &c1, &c2, true);

        // miner side
        let prev_raw: H256 = hx(p[1].as_str().unwrap()).try_into().unwrap();
        let prev = swap_words(&prev_raw);
        assert_eq!(prev, t.prev);
        let en1 = hx("deadbeef");
        let en2 = hx("0000000000000007");
        let cb = [hx(p[2].as_str().unwrap()), en1.clone(), en2.clone(), hx(p[3].as_str().unwrap())].concat();
        let branches: Vec<H256> =
            p[4].as_array().unwrap().iter().map(|x| hx(x.as_str().unwrap()).try_into().unwrap()).collect();
        let version = u32::from_str_radix(p[5].as_str().unwrap(), 16).unwrap() | 0x0000_2000;
        let bits = u32::from_str_radix(p[6].as_str().unwrap(), 16).unwrap();
        let ntime = u32::from_str_radix(p[7].as_str().unwrap(), 16).unwrap();
        let root = merkle_root(sha256d(&cb), &branches);
        let mut nonce = 0u32;
        let mut hdr = [0u8; 80];
        loop {
            hdr[0..4].copy_from_slice(&version.to_le_bytes());
            hdr[4..36].copy_from_slice(&prev);
            hdr[36..68].copy_from_slice(&root);
            hdr[68..72].copy_from_slice(&ntime.to_le_bytes());
            hdr[72..76].copy_from_slice(&bits.to_le_bytes());
            hdr[76..80].copy_from_slice(&nonce.to_le_bytes());
            if hash_diff(&sha256d(&hdr)) >= 0.0001 {
                break;
            }
            nonce += 1;
        }
        let miner_hash = sha256d(&hdr);

        // pool side
        let c = check(&t, &steps, cb.clone(), version, ntime, nonce);
        assert_eq!(c.hash, miner_hash);
        assert!(c.diff >= 0.0001);
        // regtest-style bits, so this also counts as a block
        assert!(c.is_block);

        // block serialisation: header, 3 txs, segwit coinbase, then tx data
        let b = block_hex(&t, &c);
        assert!(b.starts_with(&hex::encode(c.header)));
        assert_eq!(&b[160..162], "03");
        assert_eq!(&b[162 + 8..162 + 12], "0001");
        assert!(b.ends_with("0102"));
        assert_eq!(b.len(), 160 + 2 + (cb.len() + 2 + 34) * 2 + 4);
    }

    /// The coinbase of mainnet block 840000: stripping its witness gives the
    /// txid, and block_hex puts marker, flag and witness back where they were.
    #[test]
    fn segwit_coinbase_840000() {
        let w = "010000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff600340d10c192f5669614254432f4d696e65642062792062757a7a3132302f2cfabe6d6d144b553283a6e1a150c9989428c0695e3a1bef7d482ed1f829bbe25897fd37dc10000000000000001058a4c9000cc3a31889b38ae08249000000000000ffffffff03fb80e4f2000000001976a914536ffa992491508dca0354e52f32a3a7a679a53a88ac00000000000000002b6a2952534b424c4f434b3a52e15efafb3e2cf6dc2fc0e6bde5cb1d7d2143f1e089bd874e6b7913005fb2a00000000000000000266a24aa21a9ed88601d3d03ccce017fe2131c4c95a7292e4372983148e62996bb5e2de0e4d1d80120000000000000000000000000000000000000000000000000000000000000000000000000";
        let wb = hx(w);
        let n = [&wb[..4], &wb[6..wb.len() - 38], &wb[wb.len() - 4..]].concat();
        assert_eq!(display(&sha256d(&n)), "a0db149ace545beabbd87a8d6b20ffd6aa3b5a50e58add49a3d435f898c272cf");
        let mut t = sample();
        t.txids.clear();
        t.txdata.clear();
        let c = check(&t, &[], n, t.version, t.curtime, 0);
        let b = block_hex(&t, &c);
        assert_eq!(&b[162..], w);
    }

    #[test]
    fn targets() {
        assert_eq!(hex::encode(bits_to_target(0x1d00ffff)), format!("00000000ffff{}", "0".repeat(52)));
        assert!((target_diff(&bits_to_target(0x1d00ffff)) - 1.0).abs() < 1e-9);
    }
}
