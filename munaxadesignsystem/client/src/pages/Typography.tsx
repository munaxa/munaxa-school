import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Typography() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/tokens");
  }, [setLocation]);

  return null;
}
