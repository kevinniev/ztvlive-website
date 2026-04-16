import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Download, Play, Tv, DollarSign, Rocket, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function PromoDownloadsPage() {
  const promos = [
    {
      id: 'creator-revolution',
      title: 'Creator Revolution',
      description: 'THE HARSH TRUTH: 50% of creators stuck under $10K! Join the revolution - 70% revenue share.',
      icon: Rocket,
      color: 'from-red-600 to-purple-600',
      downloadUrl: `${API}/api/download/promo/creator-revolution`,
      filename: 'ZTVLIVE_Promo_Creator_Revolution.mp4',
      featured: true
    },
    {
      id: '70-percent-revolution',
      title: 'The 70% Revolution',
      description: 'Fast-paced promo highlighting creator earnings - "You keep 70%"',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      downloadUrl: `${API}/api/download/promo/70-percent-revolution`,
      filename: 'ZTVLIVE_Promo_70_Percent_Revolution.mp4'
    },
    {
      id: 'big-screen-dreams',
      title: 'Big Screen Dreams',
      description: 'Cinematic promo showcasing TV platform reach - Roku, Fire TV, Samsung, LG',
      icon: Tv,
      color: 'from-purple-500 to-indigo-600',
      downloadUrl: `${API}/api/download/promo/big-screen-dreams`,
      filename: 'ZTVLIVE_Promo_Big_Screen_Dreams.mp4'
    }
  ];

  const handleDownload = async (promo) => {
    try {
      const response = await fetch(promo.downloadUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = promo.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(promo.downloadUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <div className="pt-20 pb-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ZTVLIVE Promo Videos
          </h1>
          <p className="text-gray-400 text-lg">
            Download our official promotional videos for marketing and sharing
          </p>
        </div>
      </div>

      {/* Promo Cards */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {promos.map((promo) => {
            const Icon = promo.icon;
            return (
              <Card key={promo.id} className="bg-gray-800/50 border-gray-700 overflow-hidden">
                <div className={`h-32 bg-gradient-to-r ${promo.color} flex items-center justify-center`}>
                  <Icon className="w-16 h-16 text-white/80" />
                </div>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    {promo.title}
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    {promo.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={() => handleDownload(promo)}
                    className="w-full bg-red-600 hover:bg-red-700"
                    data-testid={`download-${promo.id}`}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download MP4
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                    onClick={() => window.open(promo.downloadUrl, '_blank')}
                    data-testid={`open-${promo.id}`}
                  >
                    Open in New Tab
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Direct Links Section */}
        <div className="mt-12 p-6 bg-gray-800/30 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold mb-4">Direct Download Links</h3>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-gray-400">Promo 1 - The 70% Revolution:</span>
              <code className="bg-gray-900 px-3 py-2 rounded text-green-400 break-all">
                {window.location.origin}/api/download/promo/70-percent-revolution
              </code>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-gray-400">Promo 2 - Big Screen Dreams:</span>
              <code className="bg-gray-900 px-3 py-2 rounded text-purple-400 break-all">
                {window.location.origin}/api/download/promo/big-screen-dreams
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
