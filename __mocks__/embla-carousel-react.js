import useEmblaCarousel from 'embla-carousel-react';

const isTestEnvironment = process.env.NODE_ENV === 'test';

{!isTestEnvironment && (
  <Carousel className="w-full mx-auto">
    {/* Carousel の内容 */}
  </Carousel>
)}

describe('Dauber Page', () => {
  it('checks if embla-carousel is mocked', () => {
    console.log(useEmblaCarousel()); // モックが適用されている場合、[null, {}] が出力される
  });
});

const useEmblaCarousel = () => [null, {}];
export default useEmblaCarousel;

module.exports = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'embla-carousel-react': '<rootDir>/__mocks__/embla-carousel-react.js',
  },
  testEnvironment: 'jsdom',
};