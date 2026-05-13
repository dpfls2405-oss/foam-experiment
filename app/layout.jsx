import './globals.css';

export const metadata = {
  title: '발포 실험 트래커',
  description: '우레탄 발포라인 OFAT 실험 데이터 관리',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
