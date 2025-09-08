/* Minimal mock for embla-carousel-react used in tests/SSR */

import React from "react";

function useEmblaCarousel() {
  // Return the same tuple shape as the real hook: [ref, api]
  return [null, { scrollNext() {}, scrollPrev() {} }];
}

function EmblaCarouselReact(props) {
  // Render a plain container so components depending on it can mount
  return React.createElement(
    "div",
    { "data-embla-mock": true },
    props.children,
  );
}

export default useEmblaCarousel;
export { EmblaCarouselReact };
