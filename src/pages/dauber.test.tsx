import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom'; // 念のため直接インポート
import React from 'react';

describe('Sample Test', () => {
  it('renders a simple text', () => {
    render(<div>Hello, World!</div>);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });
});

const Dauber: React.FC = () => {
  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white font-sans">
      <Header className="mx-auto" />
      <main className="container mx-auto px-4">
        <h1>Dauber</h1> {/* タイトルを追加 */}
        <section className="mt-8" aria-label="プロジェクト画像ギャラリー">
          {/* ギャラリーの内容 */}
          <p>ここにプロジェクト画像ギャラリーが表示されます。</p>
        </section>
      </main>
      <Footer className="max-w-7xl mx-auto px-4" />
    </div>
  );
};

export default Dauber;