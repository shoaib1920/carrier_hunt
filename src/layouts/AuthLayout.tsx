import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex shadow-2xl rounded-3xl overflow-hidden bg-white">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
