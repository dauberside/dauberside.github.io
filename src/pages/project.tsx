import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

const Project = () => {
  const router = useRouter();

  const _handleChatClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    router.push("/chat");
  };

  return (
    <div className="min-h-screen bg-[rgb(0,14,40)] text-white font-sans">
      <Head>
        <title>Projects</title>
      </Head>
      <Header />
      <main>
        <div className="w-full max-w-[1140px] mx-auto px-[50px] py-6">
          {
            <Link href="/dauber" legacyBehavior>
              <a>
                <div className="col-span-1 md:col-span-2">
                  <div className="text-white font-mono text-sm">
                    <div className="grid grid-cols-6 gap-4 py-2 border-t border-b border-gray-700 pb-2">
                      <div className="col-span-1 pl-2">
                        <small>🙆‍♂️</small>
                      </div>
                      <div className="col-span-1">
                        <small>2020</small>
                      </div>
                      <div className="col-span-1">
                        <small>Dauber</small>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            </Link>
          }
          {/*<Link href="/Sketch" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="row toybox">
                    <div className="col-1"><small>🗒</small></div>
                    <div className="col-2"><small>2020</small></div>
                    <div className="col-6"><small>Sketch</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link> 
          */}
          {/* 
        <Link href="#" legacyBehavior>
          <a onClick={handleChatClick}>
            <div className="col-md-12">
              <div className="grid_row">
                <div className="grid grid-cols-6 gap-4 py-2 border-b border-gray-700 pb-2">
                  <div className="col-1"><small>💬</small></div>
                  <div className="col-2"><small>2023</small></div>
                  <div className="col-6"><small>Chat</small></div>
                </div>
              </div>
            </div>
          </a>
        </Link>
        */}
          {/*
            <Link href="/continuance" legacyBehavior>
            <a>
              <div className="col-md-12">
                <div className="grid_row">
                  <div className="row toybox">
                    <div className="col-1"><small>🔁</small></div>
                    <div className="col-2"><small>🍺</small></div>
                    <div className="col-6"><small>continuance</small></div>
                  </div>
                </div>
              </div>
            </a>
          </Link> */}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Project;
