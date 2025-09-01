import React from "react";

// Accept standard <footer> props including className
export type FooterProps = React.ComponentProps<"footer">;

const Footer: React.FC<FooterProps> = ({ className, ...props }) => {
  return <footer id="footer" className={className} {...props} />;
};

export default Footer;
