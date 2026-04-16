import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginPage from "./LoginPage";

// RegisterPage - Renders LoginPage in signup mode
export default function RegisterPage() {
  return <LoginPage defaultMode="signup" />;
}
