export default function PrivacyPolicy() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold font-mono text-primary">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground font-mono">Last updated: April 6, 2026</p>

      {[
        {
          title: "1. Information We Collect",
          content: "AxeMobile is a local mining dashboard. We do not collect, store, or transmit any personal information to external servers. All miner data (IP addresses, hashrate, device names) is stored locally on your device only."
        },
        {
          title: "2. Network Access",
          content: "The app connects to your local network to communicate with mining hardware (BitAxe, NerdAxe, Avalon Nano). It also makes requests to public APIs for Bitcoin price data, block information, and pool statistics. No personal data is sent in these requests."
        },
        {
          title: "3. Local Storage",
          content: "We use your device's local storage to save preferences such as theme selection, platform choice, miner configurations, and your Atlas Pool wallet address. This data never leaves your device."
        },
        {
          title: "4. Third-Party Services",
          content: "The app may display content from third-party websites (e.g., AtlasPool dashboard, DTV Electronics) via in-app browser views. These sites have their own privacy policies and we are not responsible for their data practices."
        },
        {
          title: "5. Analytics & Tracking",
          content: "AxeMobile does not use any analytics, tracking, or advertising SDKs. We do not track your usage or behavior in any way."
        },
        {
          title: "6. Children's Privacy",
          content: "Our app is not directed at children under 13. We do not knowingly collect information from children."
        },
        {
          title: "7. Changes to This Policy",
          content: "We may update this privacy policy from time to time. Changes will be reflected in the app with an updated date."
        },
        {
          title: "8. Contact",
          content: "If you have questions about this privacy policy, please reach out via the project's GitHub repository."
        },
      ].map((section) => (
        <div key={section.title} className="space-y-2">
          <h2 className="text-base font-bold font-mono">{section.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
        </div>
      ))}
    </div>
  );
}