import React from "react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

const Home = () => {
  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white font-sans">
      <Header />
      <main>{/* ここにメインコンテンツを追加します */}</main>
      <Footer />
    </div>
  );
};

export default Home;
