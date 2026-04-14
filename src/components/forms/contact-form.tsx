"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { FormInput } from "@/components/shared/form-input";
import { FormTextarea } from "@/components/shared/form-textarea";
import { FormButton } from "@/components/shared/form-button";
import { EButtonSize } from "@/types";

export function ContactForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate submission
    setTimeout(() => setIsLoading(false), 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormInput
          name="name"
          label="Full Name"
          placeholder="John Doe"
          required
        />
        <FormInput
          name="email"
          label="Email"
          type="email"
          placeholder="john@example.com"
          required
        />
      </div>
      <FormInput
        name="subject"
        label="Subject"
        placeholder="How can we help?"
        required
      />
      <FormTextarea
        name="message"
        label="Message"
        placeholder="Tell us more about your inquiry..."
        required
        rows={5}
      />
      <FormButton
        type="submit"
        label="Send Message"
        icon={Send}
        size={EButtonSize.Large}
        isLoading={isLoading}
        className="w-full bg-olive-700 hover:bg-olive-600 text-white"
      />
    </form>
  );
}
