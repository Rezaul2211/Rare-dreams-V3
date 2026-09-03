import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, MapPin, Check, X, Building2 } from 'lucide-react';
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

  // Handle outside clicks to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        districtContainerRef.current &&
        !districtContainerRef.current.contains(event.target as Node)
      ) {
        setDistrictDropdownOpen(false);
      }
      if (
        thanaContainerRef.current &&
        !thanaContainerRef.current.contains(event.target as Node)
      ) {
        setThanaDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Select District
  const handleSelectDistrict = (dist: DistrictInfo) => {
    onDistrictChange(dist.nameEn, dist.nameBn, dist.isDhaka);
    setDistrictQuery('');
    setDistrictDropdownOpen(false);

    // Auto-focus Thana search box immediately
    setTimeout(() => {
      setThanaDropdownOpen(true);
      thanaInputRef.current?.focus();
    }, 120);
  };

  // Clear District
  const handleClearDistrict = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDistrictChange('', '', false);
    onThanaChange('', '');
    setDistrictQuery('');
    setThanaQuery('');
    setDistrictDropdownOpen(true);
    districtInputRef.current?.focus();
  };

  // Select Thana
  const handleSelectThana = (thana: UpazilaInfo) => {
    onThanaChange(thana.nameEn, thana.nameBn);
    setThanaQuery('');
    setThanaDropdownOpen(false);
  };

  // Clear Thana
  const handleClearThana = (e: React.MouseEvent) => {
    e.stopPropagation();
    onThanaChange('', '');
    setThanaQuery('');
    setThanaDropdownOpen(true);
    thanaInputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      {/* 2 Side-by-Side Search Boxes with Clear Labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        {/* ========================================================= */}
        {/* 1. DISTRICT SEARCH BOX */}
        {/* ========================================================= */}
        <div ref={districtContainerRef} className="relative">
          <label className="block text-xs font-bold text-neutral-800 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-orange-600" />
              <span>জেলা নির্বাচন করুন *</span>
            </span>
            {selectedDistrict && (
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                সিলেক্টেড
              </span>
            )}
          </label>

          <div
            className={`relative flex items-center bg-white border rounded-xl transition-all shadow-2xs ${
              !selectedDistrict && error
                ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20'
                : districtDropdownOpen
                ? 'border-orange-500 ring-2 ring-orange-500/15'
                : 'border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <div className="pl-3 pr-1 text-neutral-400 pointer-events-none">
              <Search size={15} />
            </div>

            <input
              ref={districtInputRef}
              type="text"
              autoComplete="off"
              value={
                districtDropdownOpen
                  ? districtQuery
                  : currentDistrictObj
                  ? `${currentDistrictObj.nameBn} (${currentDistrictObj.nameEn})`
                  : ''
              }
              onChange={(e) => {
                setDistrictQuery(e.target.value);
                if (!districtDropdownOpen) setDistrictDropdownOpen(true);
              }}
              onFocus={() => {
                setDistrictDropdownOpen(true);
                // Clear query text on re-focus so user can type freely
                setDistrictQuery('');
              }}
              placeholder="জেলা খুঁজুন বা নির্বাচন করুন..."
              className="w-full py-3 pr-8 pl-1 text-xs sm:text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal outline-none bg-transparent"
            />

            <div className="pr-2.5 flex items-center gap-1">
              {selectedDistrict ? (
                <button
                  type="button"
                  onClick={handleClearDistrict}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="জেলা পরিবর্তন করতে মুছুন"
                >
                  <X size={14} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setDistrictDropdownOpen((prev) => !prev);
                  if (!districtDropdownOpen) districtInputRef.current?.focus();
                }}
                className="text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
              >
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    districtDropdownOpen ? 'rotate-180 text-orange-600' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* District Live Search Dropdown */}
          {districtDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden max-h-64 sm:max-h-72 flex flex-col animate-in fade-in-50 duration-150">
              <div className="p-2 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 flex justify-between items-center">
                <span>বাংলাদেশ এর ৬৪টি জেলা ({filteredDistricts.length}টি পাওয়া গেছে)</span>
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
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer ${
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
                          <span className="block text-[10px] text-neutral-400">
                            বিভাগ: {dist.division}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              dist.isDhaka
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {dist.isDhaka ? '৳৮০ (ঢাকা)' : '৳১২০ (বাহিরে)'}
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-orange-600" />
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-neutral-400 text-xs">
                    <p className="font-bold">"{districtQuery}" নামে কোনো জেলা পাওয়া যায়নি</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      বাংলা বা ইংরেজিতে সঠিক বানান লিখে সার্চ করুন
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. THANA / UPAZILA SEARCH BOX */}
        {/* ========================================================= */}
        <div ref={thanaContainerRef} className="relative">
          <label className="block text-xs font-bold text-neutral-800 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Building2 size={13} className="text-purple-600" />
              <span>থানা / উপজেলা নির্বাচন করুন *</span>
            </span>
            {selectedThana && (
              <span className="text-[10px] text-purple-600 font-bold bg-purple-50 px-1.5 py-0.5 rounded">
                সিলেক্টেড
              </span>
            )}
          </label>

          <div
            className={`relative flex items-center bg-white border rounded-xl transition-all shadow-2xs ${
              !selectedDistrict
                ? 'bg-neutral-100/70 border-neutral-200 cursor-not-allowed'
                : selectedDistrict && !selectedThana && error
                ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20'
                : thanaDropdownOpen
                ? 'border-purple-500 ring-2 ring-purple-500/15'
                : 'border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <div className="pl-3 pr-1 text-neutral-400 pointer-events-none">
              <Search size={15} />
            </div>

            <input
              ref={thanaInputRef}
              type="text"
              autoComplete="off"
              disabled={!selectedDistrict}
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
                if (selectedDistrict) {
                  setThanaDropdownOpen(true);
                  setThanaQuery('');
                }
              }}
              onClick={() => {
                if (!selectedDistrict) {
                  setDistrictDropdownOpen(true);
                  districtInputRef.current?.focus();
                }
              }}
              placeholder={
                selectedDistrict
                  ? 'থানা বা উপজেলা খুঁজুন...'
                  : 'প্রথমে জেলা নির্বাচন করুন'
              }
              className={`w-full py-3 pr-8 pl-1 text-xs sm:text-sm font-semibold outline-none bg-transparent ${
                selectedDistrict
                  ? 'text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal cursor-text'
                  : 'text-neutral-400 placeholder:text-neutral-400 cursor-pointer'
              }`}
            />

            <div className="pr-2.5 flex items-center gap-1">
              {selectedThana ? (
                <button
                  type="button"
                  onClick={handleClearThana}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                  title="থানা পরিবর্তন করতে মুছুন"
                >
                  <X size={14} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!selectedDistrict) {
                    setDistrictDropdownOpen(true);
                    districtInputRef.current?.focus();
                  } else {
                    setThanaDropdownOpen((prev) => !prev);
                    if (!thanaDropdownOpen) thanaInputRef.current?.focus();
                  }
                }}
                className="text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
              >
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    thanaDropdownOpen ? 'rotate-180 text-purple-600' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Thana Live Search Dropdown */}
          {thanaDropdownOpen && selectedDistrict && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden max-h-64 sm:max-h-72 flex flex-col animate-in fade-in-50 duration-150">
              <div className="p-2 bg-neutral-50 border-b border-neutral-100 text-[11px] font-bold text-neutral-500 flex justify-between items-center">
                <span>
                  {currentDistrictObj?.nameBn} জেলার থানা ({filteredThanas.length}টি)
                </span>
                <span className="text-[10px] text-purple-600 font-semibold">
                  ক্লিক করে সিলেক্ট করুন
                </span>
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
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 text-purple-950 font-bold'
                            : 'hover:bg-neutral-50 text-neutral-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-xs sm:text-sm text-neutral-900">
                            {thana.nameBn}
                          </span>{' '}
                          <span className="text-[11px] text-neutral-500">
                            ({thana.nameEn})
                          </span>
                        </div>

                        {isSelected && (
                          <Check size={14} className="text-purple-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-neutral-400 text-xs">
                    <p className="font-bold">"{thanaQuery}" নামে কোনো থানা পাওয়া যায়নি</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      বাংলা বা ইংরেজিতে বানান লিখে দেখুন
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Location Pill & Delivery Charge Indicator */}
      {currentDistrictObj ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 text-neutral-800">
            <Check size={13} className="text-emerald-600 shrink-0 font-bold" />
            <span className="font-semibold">
              নির্বাচিত এলাকা:{' '}
              <b className="text-neutral-950 font-extrabold">
                {currentDistrictObj.nameBn}
              </b>
              {currentThanaObj ? ` > ${currentThanaObj.nameBn}` : ' (থানা নির্বাচন করুন)'}
            </span>
          </div>

          <span
            className={`font-black px-2.5 py-1 rounded-full text-[11px] ${
              currentDistrictObj.isDhaka
                ? 'bg-orange-100 text-orange-900 border border-orange-200'
                : 'bg-blue-100 text-blue-900 border border-blue-200'
            }`}
          >
            {currentDistrictObj.isDhaka
              ? 'ঢাকার ভিতরে (ডেলিভারি চার্জ ৳৮০)'
              : 'ঢাকার বাহিরে (ডেলিভারি চার্জ ৳১২০)'}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-neutral-500 px-1">
          💡 সঠিক জেলা ও থানা নির্বাচন করলে নির্ধারিত হোম ডেলিভারি চার্জ স্বয়ংক্রিয়ভাবে যুক্ত হবে।
        </p>
      )}
    </div>
  );
};
