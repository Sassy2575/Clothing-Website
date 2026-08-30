import React, { useEffect, useState } from 'react';


const AnnouncementBar = () => {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
  }, []);

  return (
    <div className="bg-[#1a1a1a] text-white text-xs md:text-sm text-center py-2 px-4 tracking-wide flex items-center justify-center gap-3">
      
      {/* 🔥 Image */}
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt="banner" 
          className="h-6 w-auto object-contain"
        />
      )}

      <span className="font-medium">Sapna Munoth signature block</span>

      <span className="hidden md:inline mx-2">|</span>

      <span className="opacity-90 hidden md:inline">
        Free International Shipping over ₹25,000
      </span>
    </div>
  );
};

export default AnnouncementBar;