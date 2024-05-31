// pages/index.js
import React, { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/js/crime.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);
  
  return (
    <div>
      <h1>Welcome to my site</h1>
      <p>This is a static page converted to Next.js</p>
      <img src="/images/habit_int.gif" alt="Example Image" />
    </div>
  );
}