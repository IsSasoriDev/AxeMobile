import { WebViewFrame } from "@/components/webview/WebViewFrame";

export default function GitHub() {
  return (
    <WebViewFrame
      url="https://github.com/IsSasoriDev"
      title="IsSasoriDev GitHub Profile"
      onClose={() => window.history.back()}
    />
  );
}