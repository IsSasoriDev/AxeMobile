//! Bitcoin addresses to output scripts. Only what the coinbase needs:
//! P2PKH, P2SH, and segwit v0/v1 (bech32 / bech32m).

use sha2::{Digest, Sha256};

/// Which address family the node is on, from `getblockchaininfo.chain`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Net {
    Main,
    /// testnet3, testnet4 and signet share prefixes
    Test,
    Regtest,
}

impl Net {
    pub fn from_chain(chain: &str) -> Net {
        match chain {
            "main" | "mainnet" | "" => Net::Main,
            "regtest" => Net::Regtest,
            _ => Net::Test,
        }
    }

    fn hrp(self) -> &'static str {
        match self {
            Net::Main => "bc",
            Net::Test => "tb",
            Net::Regtest => "bcrt",
        }
    }

    fn b58(self) -> (u8, u8) {
        match self {
            Net::Main => (0x00, 0x05),
            _ => (0x6f, 0xc4),
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Net::Main => "mainnet",
            Net::Test => "testnet",
            Net::Regtest => "regtest",
        }
    }
}

/// The output script that pays `addr`, or why it can't be used.
pub fn script_for(addr: &str, net: Net) -> Result<Vec<u8>, String> {
    let addr = addr.trim();
    if addr.is_empty() {
        return Err("no address".into());
    }
    let lower = addr.to_ascii_lowercase();
    if lower.starts_with(&format!("{}1", net.hrp())) {
        let (hrp, ver, prog) = bech32::segwit::decode(addr).map_err(|e| format!("bad address: {e}"))?;
        if hrp.to_lowercase() != net.hrp() {
            return Err(format!("this address is not for {}", net.name()));
        }
        let v = ver.to_u8();
        let mut s = Vec::with_capacity(prog.len() + 2);
        s.push(if v == 0 { 0x00 } else { 0x50 + v });
        s.push(prog.len() as u8);
        s.extend_from_slice(&prog);
        return Ok(s);
    }
    if lower.starts_with("bc1") || lower.starts_with("tb1") || lower.starts_with("bcrt1") {
        return Err(format!("this address is not for {}", net.name()));
    }
    let raw = bs58::decode(addr).into_vec().map_err(|_| "bad address".to_string())?;
    if raw.len() != 25 {
        return Err("bad address".into());
    }
    let check = Sha256::digest(Sha256::digest(&raw[..21]));
    if check[..4] != raw[21..] {
        return Err("bad address (checksum)".into());
    }
    let (pkh, sh) = net.b58();
    let h = &raw[1..21];
    if raw[0] == pkh {
        let mut s = vec![0x76, 0xa9, 0x14];
        s.extend_from_slice(h);
        s.extend_from_slice(&[0x88, 0xac]);
        Ok(s)
    } else if raw[0] == sh {
        let mut s = vec![0xa9, 0x14];
        s.extend_from_slice(h);
        s.push(0x87);
        Ok(s)
    } else {
        Err(format!("this address is not for {}", net.name()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scripts() {
        // BIP173 / BIP350 vectors
        assert_eq!(
            hex::encode(script_for("BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4", Net::Main).unwrap()),
            "0014751e76e8199196d454941c45d1b3a323f1433bd6"
        );
        assert_eq!(
            hex::encode(script_for("bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", Net::Main).unwrap()),
            "512079be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"
        );
        // genesis coinbase address
        assert_eq!(
            hex::encode(script_for("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", Net::Main).unwrap()),
            "76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac"
        );
        assert!(script_for("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", Net::Main).unwrap().starts_with(&[0xa9, 0x14]));
        assert!(script_for("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", Net::Test).is_err());
        assert!(script_for("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb", Net::Main).is_err());
        assert!(script_for("", Net::Main).is_err());
    }
}
