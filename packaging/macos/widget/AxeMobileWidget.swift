// AxeMobile widgets for macOS (desktop and Notification Center).
// The AxeMobile app serves a small read-only summary on 127.0.0.1:3848;
// the widget reads it every few minutes. When the app isn't running the
// widget says so instead of showing stale numbers.

import SwiftUI
import WidgetKit

// MARK: - Data

struct WMiner: Decodable, Hashable {
    let name: String
    let online: Bool
    let hashrate: Double?
    let temp: Double?
    let power: Double?
}

struct WFleet: Decodable {
    let online: Int
    let total: Int
    let hashrate: Double
    let power: Double
    let efficiency: Double?
    let best: Double
    let hottest: Double?
    let theme: String
    let miners: [WMiner]
    let updated: Int

    static let sample = WFleet(
        online: 2, total: 2, hashrate: 6190, power: 108.8, efficiency: 17.6, best: 1.36e9, hottest: 51,
        theme: "default",
        miners: [
            WMiner(name: "NerdQaxe++", online: true, hashrate: 5680, temp: 44.9, power: 95.6),
            WMiner(name: "NerdAxe", online: true, hashrate: 513, temp: 51.0, power: 13.2),
        ],
        updated: 0)
}

struct FleetEntry: TimelineEntry {
    let date: Date
    let fleet: WFleet?
}

struct Provider: TimelineProvider {
    private let url = URL(string: "http://127.0.0.1:3848/api/widget")!

    func placeholder(in context: Context) -> FleetEntry {
        FleetEntry(date: .now, fleet: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (FleetEntry) -> Void) {
        if context.isPreview {
            completion(FleetEntry(date: .now, fleet: .sample))
            return
        }
        fetch { completion(FleetEntry(date: .now, fleet: $0 ?? .sample)) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FleetEntry>) -> Void) {
        fetch { fleet in
            let next = Date.now.addingTimeInterval(fleet == nil ? 120 : 300)
            completion(Timeline(entries: [FleetEntry(date: .now, fleet: fleet)], policy: .after(next)))
        }
    }

    private func fetch(_ done: @escaping (WFleet?) -> Void) {
        var req = URLRequest(url: url)
        req.timeoutInterval = 4
        URLSession.shared.dataTask(with: req) { data, _, _ in
            done(data.flatMap { try? JSONDecoder().decode(WFleet.self, from: $0) })
        }.resume()
    }
}

// MARK: - Formatting

func hashParts(_ ghs: Double?) -> (String, String) {
    guard let g = ghs, g.isFinite else { return ("–", "GH/s") }
    if g >= 1_000_000 { return (String(format: "%.2f", g / 1_000_000), "PH/s") }
    if g >= 1000 { return (String(format: "%.2f", g / 1000), "TH/s") }
    return (String(format: g >= 100 ? "%.0f" : "%.1f", g), "GH/s")
}

func diffString(_ d: Double) -> String {
    guard d > 0 else { return "–" }
    let units = ["", "K", "M", "G", "T", "P", "E"]
    var v = d
    var i = 0
    while v >= 1000 && i < units.count - 1 {
        v /= 1000
        i += 1
    }
    return String(format: v >= 100 ? "%.0f%@" : "%.2f%@", v, units[i])
}

// MARK: - Theme

struct Palette {
    let bg: [Color]
    let accent: Color
    let accent2: Color
    let text: Color
    let dim: Color
    let good: Color

    static func of(_ theme: String) -> Palette {
        if theme == "dtv" {
            return Palette(
                bg: [Color(red: 0.03, green: 0.03, blue: 0.04), Color(red: 0.12, green: 0.05, blue: 0.10)],
                accent: Color(red: 1.0, green: 0.42, blue: 0.0),
                accent2: Color(red: 0.69, green: 0.33, blue: 0.08),
                text: .white, dim: Color(white: 0.6), good: Color(red: 0.0, green: 0.8, blue: 0.53))
        }
        return Palette(
            bg: [Color(red: 0.03, green: 0.04, blue: 0.06), Color(red: 0.06, green: 0.13, blue: 0.23)],
            accent: Color(red: 0.0, green: 0.9, blue: 1.0),
            accent2: Color(red: 1.0, green: 0.17, blue: 0.84),
            text: Color(red: 0.9, green: 0.93, blue: 0.96), dim: Color(red: 0.6, green: 0.66, blue: 0.74),
            good: Color(red: 0.17, green: 1.0, blue: 0.53))
    }
}

// MARK: - Views

struct Ring: View {
    let fraction: Double
    let pal: Palette
    var body: some View {
        ZStack {
            Circle().trim(from: 0, to: 0.75).stroke(pal.dim.opacity(0.25), style: StrokeStyle(lineWidth: 7, lineCap: .round))
            Circle().trim(from: 0, to: 0.75 * min(max(fraction, 0), 1))
                .stroke(AngularGradient(colors: [pal.accent, pal.accent2], center: .center), style: StrokeStyle(lineWidth: 7, lineCap: .round))
        }
        .rotationEffect(.degrees(135))
    }
}

struct Offline: View {
    let pal: Palette
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("AxeMobile").font(.headline).foregroundStyle(pal.accent)
            Text("Open AxeMobile to see your miners here.").font(.caption).foregroundStyle(pal.dim)
        }
    }
}

struct SmallView: View {
    let f: WFleet
    let pal: Palette
    var body: some View {
        let (v, u) = hashParts(f.hashrate)
        VStack(spacing: 4) {
            ZStack {
                Ring(fraction: f.total > 0 ? Double(f.online) / Double(f.total) : 0, pal: pal)
                VStack(spacing: 0) {
                    Text(v).font(.system(size: 22, weight: .heavy, design: .rounded)).foregroundStyle(pal.text).minimumScaleFactor(0.6)
                    Text(u).font(.system(size: 10, weight: .bold)).foregroundStyle(pal.accent)
                }
            }
            .frame(width: 92, height: 92)
            Text("\(f.online)/\(f.total) online · \(Int(f.power.rounded())) W").font(.system(size: 10, weight: .semibold)).foregroundStyle(pal.dim)
        }
    }
}

struct MinerRow: View {
    let m: WMiner
    let pal: Palette
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(m.online ? pal.good : Color.red).frame(width: 6, height: 6)
            Text(m.name).font(.system(size: 11, weight: .semibold)).foregroundStyle(pal.text).lineLimit(1)
            Spacer(minLength: 4)
            Text(m.online ? hashParts(m.hashrate).0 + " " + hashParts(m.hashrate).1 : "offline")
                .font(.system(size: 11, weight: .bold, design: .rounded)).foregroundStyle(m.online ? pal.text : pal.dim)
            if let t = m.temp, m.online {
                Text("\(Int(t.rounded()))°").font(.system(size: 10, weight: .semibold)).foregroundStyle(t >= 70 ? .red : (t >= 62 ? .orange : pal.good))
            }
        }
    }
}

struct MediumView: View {
    let f: WFleet
    let pal: Palette
    let rows: Int
    var body: some View {
        let (v, u) = hashParts(f.hashrate)
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("AxeMobile").font(.system(size: 12, weight: .heavy)).foregroundStyle(pal.accent)
                Spacer()
                Text("\(f.online)/\(f.total) online").font(.system(size: 10, weight: .bold)).foregroundStyle(f.online == f.total ? pal.good : .orange)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(v).font(.system(size: 30, weight: .heavy, design: .rounded)).foregroundStyle(pal.text)
                Text(u).font(.system(size: 13, weight: .bold)).foregroundStyle(pal.accent)
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(Int(f.power.rounded())) W").font(.system(size: 11, weight: .bold)).foregroundStyle(pal.text)
                    Text("best \(diffString(f.best))").font(.system(size: 10)).foregroundStyle(pal.dim)
                }
            }
            ForEach(f.miners.prefix(rows), id: \.self) { MinerRow(m: $0, pal: pal) }
            Spacer(minLength: 0)
        }
    }
}

struct WidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: FleetEntry

    var body: some View {
        let pal = Palette.of(entry.fleet?.theme ?? "default")
        Group {
            if let f = entry.fleet {
                switch family {
                case .systemSmall: SmallView(f: f, pal: pal)
                case .systemLarge: MediumView(f: f, pal: pal, rows: 6)
                default: MediumView(f: f, pal: pal, rows: 2)
                }
            } else {
                Offline(pal: pal)
            }
        }
        .containerBackground(for: .widget) {
            LinearGradient(colors: pal.bg, startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

@main
struct AxeMobileWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AxeMobileFleet", provider: Provider()) { entry in
            WidgetView(entry: entry)
        }
        .configurationDisplayName("AxeMobile")
        .description("Your miners' hashrate, power and status.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
