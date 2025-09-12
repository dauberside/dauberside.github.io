"use client";

import { faInstagram } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import ContactForm from "@/components/forms/ContactForm";

export const HeaderNew: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [isContactFormOpen, setContactFormOpen] = useState<boolean>(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const toggle = () => setOpen((o) => !o);
  const close = useCallback(() => setOpen(false), []);
  const handleContactFormOpen = () => setContactFormOpen(true);
  const handleContactFormClose = () => setContactFormOpen(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      } else if (e.key === "Tab") {
        setTimeout(() => {
          const active = document.activeElement;
          if (
            active &&
            !menuRef.current?.contains(active) &&
            active !== btnRef.current
          )
            close();
        }, 0);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  useEffect(() => {
    if (open) {
      const first = menuRef.current?.querySelector("button,a");
      (first as HTMLElement | undefined)?.focus();
    }
  }, [open]);

  return (
    <>
      <header id="header" className={className}>
        <div className="w-full max-w-[1140px] mx-auto px-[50px] flex items-center justify-between py-6">
          <div id="logo" className="flex items-center gap-4">
            <Link href="/" legacyBehavior>
              <a className="inline-flex items-center">
                <Image
                  src="/images/geometric_pattern.svg"
                  alt="Logo"
                  width={100}
                  height={50}
                  className="w-[30px] h-auto"
                />
              </a>
            </Link>
          </div>
          <nav>
            <ul className="flex items-center gap-5 md:gap-8 lg:gap-8">
              <li className="relative">
                <button
                  ref={btnRef}
                  onClick={toggle}
                  aria-haspopup="true"
                  aria-expanded={open}
                  className="inline-flex items-center text-sm md:text-base font-medium hover:opacity-80 outline-none focus:outline-none focus-visible:outline-none bg-transparent no-underline hover:no-underline hover:!no-underline"
                >
                  Menu
                </button>
                {open && (
                  <ul
                    ref={menuRef}
                    role="menu"
                    className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2 min-w-[8rem] rounded-md bg-white text-black shadow-lg ring-1 ring-black/10 transition py-1 before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:-top-2 before:w-0 before:h-0 before:border-x-8 before:border-x-transparent before:border-b-8 before:border-b-white"
                  >
                    <li role="none">
                      <Link href="/" legacyBehavior>
                        <a
                          role="menuitem"
                          className="block w-full px-4 py-2 text-sm text-black hover:bg-gray-100 focus:bg-gray-100 outline-none hover:outline-none focus:outline-none focus-visible:outline-none no-underline hover:no-underline"
                          onClick={close}
                        >
                          Home
                        </a>
                      </Link>
                    </li>
                    <li role="none">
                      <Link href="/project" legacyBehavior>
                        <a
                          role="menuitem"
                          className="block w-full px-4 py-2 text-sm text-black hover:bg-gray-100 focus:bg-gray-100 outline-none hover:outline-none focus:outline-none focus-visible:outline-none no-underline hover:no-underline"
                          onClick={close}
                        >
                          Project
                        </a>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <Link
                  href="https://www.instagram.com/DauberSide/"
                  legacyBehavior
                >
                  <a
                    aria-label="Instagram"
                    className="inline-flex items-center text-lg md:text-xl no-underline hover:no-underline"
                  >
                    <FontAwesomeIcon icon={faInstagram} />
                  </a>
                </Link>
              </li>
              <li>
                <button
                  onClick={handleContactFormOpen}
                  aria-label="Open contact form"
                  className="p-0 bg-transparent inline-flex items-center text-lg md:text-xl outline-none focus:outline-none no-underline hover:no-underline"
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <ContactForm
        isOpen={isContactFormOpen}
        onRequestClose={handleContactFormClose}
      />
    </>
  );
};

export default HeaderNew;
