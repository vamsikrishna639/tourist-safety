// Camera QR scanner (html5-qrcode). The widget also offers "Scan an Image File" for PCs without a webcam.
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const ELEMENT_ID = 'qr-reader';

export default function QrScanner({ onScan }) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    document.getElementById(ELEMENT_ID).innerHTML = ''; // React dev mode mounts twice: start from an empty box
    let last = { text: '', at: 0 };

    const scanner = new Html5QrcodeScanner(ELEMENT_ID, { fps: 10, qrbox: 220, rememberLastUsedCamera: true }, false);
    scanner.render(
      (text) => {
        // The camera sees the same code many times per second: react to it at most once every 5 s
        const now = Date.now();
        if (text === last.text && now - last.at < 5000) return;
        last = { text, at: now };
        onScanRef.current(text);
      },
      () => {} // called for every frame without a QR code; nothing to do
    );

    return () => {
      scanner.clear().catch(() => {}); // stop the camera when leaving the page
    };
  }, []);

  return <div id={ELEMENT_ID} />;
}
