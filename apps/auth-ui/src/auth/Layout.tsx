import React, { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import '@/styles/login-page.css';
import { gsap } from 'gsap';

export function AccountLayout(props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial animation for page load
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelector('.main-content'),
        {
          opacity: 0,
        },
        {
          opacity: 1,
          duration: 1,
          ease: 'power2.out',
        }
      );
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="login-page min-h-screen w-full bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50"
    >
      <div className="main-content min-h-[calc(100vh-80px)] py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full flex min-h-[calc(100vh-150px)] items-center justify-center">
          {props.children}
        </div>
        <div className="login-footer text-sm font-normal text-center w-full text-gray-500 mt-8">
          <p>* By logging in, you agree to our Terms of Use, that you've read our Privacy Policy and to receive emails & updates from Appmint</p>
        </div>
      </div>
    </div>
  );
}