"use client";

import { useState } from "react";
import ProfileModal from "./ProfileModal";

interface ProfileButtonProps {
  user: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    role: "admin" | "scrum_master" | "developer" | "product_owner";
  } | null;
}

export default function ProfileButton({ user }: ProfileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md"
      >
        My profile
      </button>

      <ProfileModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
     
      />
    </>
  );
}