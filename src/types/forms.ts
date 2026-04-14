import type { LucideIcon } from "lucide-react";
import type { EButtonSize } from "./enums";

export interface IFormButtonProps {
  showText?: boolean;
  showIcon?: boolean;
  size?: EButtonSize;
  label: string;
  icon?: LucideIcon;
  type?: "button" | "submit" | "reset";
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export interface IFormFieldProps {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface IContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ILoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface IRegisterFormData {
  name: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface IResetPasswordFormData {
  email: string;
}
