import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/pixel';

export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Use instant scroll to top on route navigation to prevent browser smooth-scroll momentum locks
    window.scrollTo(0, 0);
    // Track page view event in Facebook Meta Pixel
    trackPageView();
  }, [pathname, search]);

  return null;
}

