import { QRCodeSVG } from "qrcode.react";
import { config } from "@shared/config";

export function QRCodeDisplay() {
  const mobileUrl = config.mobileAppUrl;

  return (
    <div className="qr-container">
      <h2 className="qr-title">Scan to Order</h2>
      <div className="qr-code-wrapper">
        <QRCodeSVG
          value={mobileUrl}
          size={280}
          level="H"
          includeMargin={true}
          bgColor="#ffffff"
          fgColor="#1f2937"
        />
      </div>
      <p className="qr-instructions">
        Point your phone camera at the QR code to order a drink
      </p>
    </div>
  );
}
