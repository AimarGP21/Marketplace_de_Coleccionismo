'use client';

import Link from 'next/link';
import { ShieldCheck, Award, Star, ArrowRight } from 'lucide-react';
import { CollectibleItem } from '@/types';

interface CollectibleCardProps {
  item: CollectibleItem;
}

export default function CollectibleCard({ item }: CollectibleCardProps) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: item.currency.toUpperCase(),
  }).format(item.price);

  return (
    <div className="group flex flex-col bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 overflow-hidden">
      {/* Imagen del Coleccionable */}
      <div className="relative aspect-square w-full bg-slate-950 overflow-hidden flex items-center justify-center p-6 border-b border-slate-800/80">
        <img
          src={item.image}
          alt={item.title}
          className="object-contain h-full w-full group-hover:scale-105 transition-transform duration-500 drop-shadow-2xl"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {item.category}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
            {item.condition}
          </span>
        </div>

        {item.verifiedAuthenticity && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Autenticidad Verificada</span>
          </div>
        )}
      </div>

      {/* Informacion del Coleccionable */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-medium mb-1.5">
            <Award className="w-3.5 h-3.5" />
            <span>{item.rarity}</span>
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
            {item.title}
          </h3>
          <p className="text-sm text-slate-400 mt-2 line-clamp-2">
            {item.description}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium block">
              Precio de Lista
            </span>
            <span className="text-2xl font-black text-amber-400">
              {formattedPrice}
            </span>
          </div>

          <Link
            href={`/checkout?id=${item.id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all transform active:scale-95"
          >
            <span>Comprar</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
