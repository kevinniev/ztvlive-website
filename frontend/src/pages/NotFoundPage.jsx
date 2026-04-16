import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Home, Tv, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Display */}
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-red-600 mb-2">404</h1>
          <h2 className="text-2xl font-heading text-white mb-4">Page Not Found</h2>
          <p className="text-zinc-400">
            The page you're looking for doesn't exist or has been moved. 
            But don't worry, there's plenty of live content waiting for you!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button className="w-full sm:w-auto bg-red-600 hover:bg-red-500">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Link to="/watch">
            <Button variant="outline" className="w-full sm:w-auto border-zinc-600 text-white hover:bg-zinc-800">
              <Tv className="w-4 h-4 mr-2" />
              Watch Live
            </Button>
          </Link>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <button 
            onClick={() => window.history.back()}
            className="text-zinc-500 hover:text-white flex items-center gap-2 mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* ZTVLIVE Logo */}
        <div className="mt-12 flex items-center justify-center gap-2 text-zinc-600">
          <Tv className="w-6 h-6 text-red-600" />
          <span className="font-heading text-lg">ZTVLIVE</span>
        </div>
      </div>
    </div>
  );
}
