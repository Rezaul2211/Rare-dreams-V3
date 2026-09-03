import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { BD_DISTRICTS, DistrictInfo, UpazilaInfo } from '../lib/bdData';

interface SearchableLocationPickerProps {
  selectedDistrict: string;
  selectedThana: string;
  onDistrictChange: (districtEn: string, districtBn: string, isDhaka: boolean) => void;
  onThanaChange: (thanaEn: string, thanaBn: string) => void;
  error?: string | null;
}

export const SearchableLocationPicker: React.FC<SearchableLocationPickerProps> = ({
  selectedDistrict,
  selectedThana,
  onDistrictChange,
  onThanaChange,
  error,
}) => {
  // Dropdown open states
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [thanaDropdownOpen, setThanaDropdownOpen] = useState(false);

  // Search queries
  const [districtQuery, setDistrictQuery] = useState('');
  const [thanaQuery, setThanaQuery] = useState('');

  // Refs for outside click handling & input focusing
  const districtContainerRef = useRef<HTMLDivElement>(null);
  const thanaContainerRef = useRef<HTMLDivElement>(null);
  const districtInputRef = useRef<HTMLInputElement>(null);
  const thanaInputRef = useRef<HTMLInputElement>(null);

  // Current selected district object
  const currentDistrictObj = useMemo(() => {
    if (!selectedDistrict) return null;
    const lower = selectedDistrict.toLowerCase().trim();
    return (
      BD_DISTRICTS.find(
        (d) => d.nameEn.toLowerCase() === lower || d.nameBn === selectedDistrict
      ) || null
    );
  }, [selectedDistrict]);

  // Thanas list for selected district
  const thanasList = useMemo(() => {
    if (!currentDistrictObj) return [];
    return currentDistrictObj.thanas || [];
  }, [currentDistrictObj]);

  // Current selected thana object
  const currentThanaObj = useMemo(() => {
    if (!selectedThana || !thanasList.length) return null;
    const lower = selectedThana.toLowerCase().trim();
    return (
      thanasList.find(
        (t) => t.nameEn.toLowerCase() === lower || t.nameBn === selectedThana
      ) || null
    );
  }, [selectedThana, thanasList]);

  // Filtered districts based on user typing
  const filteredDistricts = useMemo(() => {
    const q = districtQuery.trim().toLowerCase();
    if (!q) return BD_DISTRICTS;
    return BD_DISTRICTS.filter(
      (d) =>
        d.nameEn.toLowerCase().includes(q) ||
        d.nameBn.includes(q) ||
        d.division.toLowerCase().includes(q)
    );
  }, [districtQuery]);

  // Filtered thanas based on user typing
  const filteredThanas = useMemo(() => {
    const q = thanaQuery.trim().toLowerCase();
    if (!q) return thanasList;
    return thanasList.filter(
      (t) => t.nameEn.toLowerCase().includes(q) || t.nameBn.includes(q)
    );
  }, [thanaQuery, thanasList]);

  // Handle outside clicks to close dropdowns safely
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (
        districtContainerRef.current &&
        !districtContainerRef.current.contains(target)
      ) {
        setDistrictDropdownOpen(false);
      }
      if (
        thanaContainerRef.current &&
        !thanaContainerRef.current.contains(target)
      ) {
        setThanaDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Select District
  const handleSelectDistrict = (dist: DistrictInfo) => {
    onDistrictChange(dist.nameEn, dist.nameBn, dist.isDhaka);
    setDistrictQuery('');
    setDistrictDropdownOpen(false);
    setThanaDropdownOpen(true);

    // Auto-focus Thana search box smoothly
    setTimeout(() => {
      thanaInputRef.current?.focus();
    }, 60);
  };

  // Select Thana
  const handleSelectThana = (thana: UpazilaInfo) => {
    onThanaChange(thana.nameEn, thana.nameBn);
    setThanaQuery('');
    setThanaDropdownOpen(false);
  };

  const hasDistrictError = !selectedDistrict && Boolean(typeof error === 'string' && error.includes('জেলা'));
  const hasThanaError = Boolean(selectedDistrict && !selectedThana && typeof error === 'string' && error.includes('থানা'));

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full">
      {/* ========================================================= */}
      {/* 1. DISTRICT BOX (LEFT) */}
      {/* ========================================================= */}
      <div ref={districtContainerRef} className="relative w-full min-w-0">
        <div
          onClick={() => {
            districtInputRef.current?.focus();
            setDistrictDropdownOpen(true);
          }}
          className={`relative flex items-center bg-white border rounded-xl transition-all cursor-pointer ${
            hasDistrictError
              ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20'
              : districtDropdownOpen
              ? 'border-orange-500 ring-2 ring-orange-500/10'
              : 'border-neutral-300 hover:border-neutral-400'
          }`}
        >
          <input
            ref={districtInputRef}
            type="text"
            autoComplete="off"
            value={
              districtDropdownOpen
                ? districtQuery
                : currentDistrictObj
                ? `${currentDistrictObj.nameBn} (${currentDistrictObj.nameEn}) — ৳${currentDistrictObj.isDhaka ? '৮০' : '১২০'}`
                : selectedDistrict || ''
            }
            onChange={(e) => {
              setDistrictQuery(e.target.value);
              if (!districtDropdownOpen) setDistrictDropdownOpen(true);
            }}
            onFocus={() => {
              setDistrictDropdownOpen(true);
              setDistrictQuery('');
            }}
            placeholder="জেলা নির্বাচন করুন"
            className="w-full bg-transparent px-3 sm:px-4 py-3.5 pr-7 sm:pr-8 outline-none text-xs sm:text-sm font-medium text-neutral-900 placeholder:text-neutral-500 placeholder:font-normal truncate cursor-pointer"
          />

          <div className="absolute right-2 sm:right-2.5 flex items-center pointer-events-none text-neutral-400">
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${
                districtDropdownOpen ? 'rotate-180 text-orange-600' : ''
              }`}
            />
          </div>
        </div>

        {/* District Dropdown with Instant Search */}
        {districtDropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-[calc(200%+0.5rem)] sm:w-full max-w-[88vw] z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden max-h-64 flex flex-col animate-in fade-in-50 duration-150">
            <div className="p-2 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 flex justify-between items-center">
              <span>৬৪টি জেলা ({filteredDistricts.length}টি পাওয়া গেছে)</span>
              <span className="text-[10px] text-orange-600 font-semibold">টাইপ করে খুঁজুন</span>
            </div>

            <div className="overflow-y-auto divide-y divide-neutral-100 p-1 flex-1">
              {filteredDistricts.length > 0 ? (
                filteredDistricts.map((dist) => {
                  const isSelected =
                    selectedDistrict.toLowerCase() === dist.nameEn.toLowerCase() ||
                    selectedDistrict === dist.nameBn;
                  return (
                    <button
                      key={dist.nameEn}
                      type="button"
                      onClick={() => handleSelectDistrict(dist)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-orange-50 text-orange-950 font-bold'
                          : 'hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold text-xs sm:text-sm text-neutral-900">
                          {dist.nameBn}
                        </span>{' '}
                        <span className="text-[11px] text-neutral-500">
                          ({dist.nameEn})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            dist.isDhaka
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {dist.isDhaka ? '৳৮০' : '৳১২০'}
                        </span>
                        {isSelected && (
                          <Check size={13} className="text-orange-600" />
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-5 text-center text-neutral-400 text-xs">
                  <p className="font-semibold">"{districtQuery}" নামে কোনো জেলা পাওয়া যায়নি</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. THANA BOX (RIGHT) */}
      {/* ========================================================= */}
      <div ref={thanaContainerRef} className="relative w-full min-w-0">
        <div
          onClick={() => {
            if (!selectedDistrict) {
              setDistrictDropdownOpen(true);
              districtInputRef.current?.focus();
            } else {
              thanaInputRef.current?.focus();
              setThanaDropdownOpen(true);
            }
          }}
          className={`relative flex items-center bg-white border rounded-xl transition-all cursor-pointer ${
            hasThanaError
              ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20'
              : thanaDropdownOpen
              ? 'border-orange-500 ring-2 ring-orange-500/10'
              : 'border-neutral-300 hover:border-neutral-400'
          }`}
        >
          <input
            ref={thanaInputRef}
            type="text"
            autoComplete="off"
            value={
              thanaDropdownOpen
                ? thanaQuery
                : currentThanaObj
                ? `${currentThanaObj.nameBn} (${currentThanaObj.nameEn})`
                : selectedThana
                ? selectedThana
                : ''
            }
            onChange={(e) => {
              setThanaQuery(e.target.value);
              if (!thanaDropdownOpen) setThanaDropdownOpen(true);
            }}
            onFocus={() => {
              if (!selectedDistrict) {
                setDistrictDropdownOpen(true);
              } else {
                setThanaDropdownOpen(true);
                setThanaQuery('');
              }
            }}
            placeholder="থানা নির্বাচন করুন"
            className="w-full bg-transparent px-3 sm:px-4 py-3.5 pr-7 sm:pr-8 outline-none text-xs sm:text-sm font-medium text-neutral-900 placeholder:text-neutral-500 placeholder:font-normal truncate cursor-pointer"
          />

          <div className="absolute right-2 sm:right-2.5 flex items-center pointer-events-none text-neutral-400">
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${
                thanaDropdownOpen ? 'rotate-180 text-orange-600' : ''
              }`}
            />
          </div>
        </div>

        {/* Thana Dropdown with Instant Search */}
        {thanaDropdownOpen && selectedDistrict && (
          <div className="absolute right-0 top-full mt-1.5 w-[calc(200%+0.5rem)] sm:w-full max-w-[88vw] z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden max-h-64 flex flex-col animate-in fade-in-50 duration-150">
            <div className="p-2 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 flex justify-between items-center">
              <span>{currentDistrictObj?.nameBn} জেলার থানা ({filteredThanas.length}টি)</span>
              <span className="text-[10px] text-orange-600 font-semibold">টাইপ করে খুঁজুন</span>
            </div>

            <div className="overflow-y-auto divide-y divide-neutral-100 p-1 flex-1">
              {filteredThanas.length > 0 ? (
                filteredThanas.map((thana) => {
                  const isSelected =
                    selectedThana.toLowerCase() === thana.nameEn.toLowerCase() ||
                    selectedThana === thana.nameBn;
                  return (
                    <button
                      key={thana.nameEn}
                      type="button"
                      onClick={() => handleSelectThana(thana)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-orange-50 text-orange-950 font-bold'
                          : 'hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold text-xs sm:text-sm text-neutral-900">
                          {thana.nameBn}
                        </span>{' '}
                        <span className="text-[11px] text-neutral-500">
                          ({thana.nameEn})
                        </span>
                      </div>

                      {isSelected && (
                        <Check size={13} className="text-orange-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="py-5 text-center text-neutral-400 text-xs">
                  <p className="font-semibold">"{thanaQuery}" নামে কোনো থানা পাওয়া যায়নি</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
