export interface UpazilaInfo {
  nameEn: string;
  nameBn: string;
}

export interface DistrictInfo {
  nameEn: string;
  nameBn: string;
  isDhaka: boolean;
  division: string;
  thanas: UpazilaInfo[];
}

export const BD_DISTRICTS: DistrictInfo[] = [
  {
    nameEn: "Dhaka",
    nameBn: "ঢাকা",
    isDhaka: true,
    division: "Dhaka",
    thanas: [
      { nameEn: "Dhanmondi", nameBn: "ধানমন্ডি" },
      { nameEn: "Mirpur", nameBn: "মিরপুর" },
      { nameEn: "Uttara", nameBn: "উত্তরা" },
      { nameEn: "Gulshan", nameBn: "গুলশান" },
      { nameEn: "Banani", nameBn: "বনানী" },
      { nameEn: "Mohammadpur", nameBn: "মোহাম্মদপুর" },
      { nameEn: "Badda", nameBn: "বাড্ডা" },
      { nameEn: "Motijheel", nameBn: "মতিঝিল" },
      { nameEn: "Ramna", nameBn: "রমনা" },
      { nameEn: "Khilgaon", nameBn: "খিলগাঁও" },
      { nameEn: "Jatrabari", nameBn: "যাত্রাবাড়ী" },
      { nameEn: "Shahbagh", nameBn: "শাহবাগ" },
      { nameEn: "Tejgaon", nameBn: "তেজগাঁও" },
      { nameEn: "Tejgaon Industrial Area", nameBn: "তেজগাঁও শিল্পাঞ্চল" },
      { nameEn: "Kafrul", nameBn: "কাফরুল" },
      { nameEn: "Pallabi", nameBn: "পল্লবী" },
      { nameEn: "Rampura", nameBn: "রামপুরা" },
      { nameEn: "Bhatara", nameBn: "ভাটারা" },
      { nameEn: "Khilkhet", nameBn: "খিলক্ষেত" },
      { nameEn: "Lalbagh", nameBn: "লালবাগ" },
      { nameEn: "Hazaribagh", nameBn: "হাজারীবাগ" },
      { nameEn: "Sabujbagh", nameBn: "সবুজবাগ" },
      { nameEn: "Mugda", nameBn: "মুগদা" },
      { nameEn: "Sutrapur", nameBn: "সূত্রাপুর" },
      { nameEn: "Kotwali", nameBn: "কোতোয়ালী" },
      { nameEn: "Gendaria", nameBn: "গেন্ডারিয়া" },
      { nameEn: "Wari", nameBn: "ওয়ারী" },
      { nameEn: "Chawkbazar", nameBn: "চকবাজার" },
      { nameEn: "Demra", nameBn: "ডেমরা" },
      { nameEn: "Kadamtali", nameBn: "কদমতলী" },
      { nameEn: "Shyampur", nameBn: "শ্যামপুর" },
      { nameEn: "Kamrangirchar", nameBn: "কামরাঙ্গীরচর" },
      { nameEn: "Cantonment", nameBn: "ক্যান্টনমেন্ট" },
      { nameEn: "Sher-e-Bangla Nagar", nameBn: "শেরেবাংলা নগর" },
      { nameEn: "Kalabagan", nameBn: "কলাবাগান" },
      { nameEn: "Adabor", nameBn: "আদাবর" },
      { nameEn: "Darussalam", nameBn: "দারুসসালাম" },
      { nameEn: "Shah Ali", nameBn: "শাহ আলী" },
      { nameEn: "Rupnagar", nameBn: "রূপনগর" },
      { nameEn: "Dakshinkhan", nameBn: "দক্ষিণখান" },
      { nameEn: "Uttarkhan", nameBn: "উত্তরখান" },
      { nameEn: "Turag", nameBn: "তুরাগ" },
      { nameEn: "Airport", nameBn: "বিমানবন্দর" },
      { nameEn: "Banashree", nameBn: "বনশ্রী" },
      { nameEn: "Aftabnagar", nameBn: "আফতাবনগর" },
      { nameEn: "Bashundhara R/A", nameBn: "বসুন্ধরা আ/এ" },
      { nameEn: "Savar", nameBn: "সাভার" },
      { nameEn: "Ashulia", nameBn: "আশুলিয়া" },
      { nameEn: "Dhamrai", nameBn: "ধামরাই" },
      { nameEn: "Keraniganj", nameBn: "কেরানীগঞ্জ" },
      { nameEn: "Dohar", nameBn: "দোহার" },
      { nameEn: "Nawabganj", nameBn: "নবাবগঞ্জ" }
    ]
  },
  {
    nameEn: "Chattogram",
    nameBn: "চট্টগ্রাম",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Kotwali", nameBn: "কোতোয়ালী" },
      { nameEn: "Panchlaish", nameBn: "পাঁচলাইশ" },
      { nameEn: "Pahartali", nameBn: "পাহাড়তলী" },
      { nameEn: "Halishahar", nameBn: "হালিশহর" },
      { nameEn: "Double Mooring", nameBn: "ডবল মুরিং" },
      { nameEn: "Patenga", nameBn: "পতেঙ্গা" },
      { nameEn: "Chandgaon", nameBn: "চান্দগাঁও" },
      { nameEn: "Bayazid", nameBn: "বায়োজিদ বোস্তামী" },
      { nameEn: "Bakalia", nameBn: "বাকলিয়া" },
      { nameEn: "Khulshi", nameBn: "খুলশী" },
      { nameEn: "Akbar Shah", nameBn: "আকবর শাহ" },
      { nameEn: "EPZ", nameBn: "ইপিজেড" },
      { nameEn: "Karnaphuli", nameBn: "কর্ণফুলী" },
      { nameEn: "Chawkbazar", nameBn: "চকবাজার" },
      { nameEn: "Hathazari", nameBn: "হাটহাজারী" },
      { nameEn: "Sitakunda", nameBn: "সীতাকুণ্ড" },
      { nameEn: "Mirsharai", nameBn: "মীরসরাই" },
      { nameEn: "Patiya", nameBn: "পটিয়া" },
      { nameEn: "Raozan", nameBn: "রাউজান" },
      { nameEn: "Rangunia", nameBn: "রাঙ্গুনিয়া" },
      { nameEn: "Boalkhali", nameBn: "বোয়ালখালী" },
      { nameEn: "Anwara", nameBn: "আনোয়ারা" },
      { nameEn: "Banshkhali", nameBn: "বাঁশখালী" },
      { nameEn: "Chandanaish", nameBn: "চন্দনাইশ" },
      { nameEn: "Fatikchhari", nameBn: "ফটিকছড়ি" },
      { nameEn: "Lohagara", nameBn: "লোহাগাড়া" },
      { nameEn: "Satkania", nameBn: "সাতকানিয়া" },
      { nameEn: "Sandwip", nameBn: "সন্দ্বীপ" }
    ]
  },
  {
    nameEn: "Gazipur",
    nameBn: "গাজীপুর",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Gazipur Sadar", nameBn: "গাজীপুর সদর" },
      { nameEn: "Tongi", nameBn: "টঙ্গী" },
      { nameEn: "Kaliakair", nameBn: "কালিয়াকৈর" },
      { nameEn: "Sreepur", nameBn: "শ্রীপুর" },
      { nameEn: "Kapasia", nameBn: "কাপাসিয়া" },
      { nameEn: "Kaliganj", nameBn: "কালীগঞ্জ" },
      { nameEn: "Joydebpur", nameBn: "জয়দেবপুর" },
      { nameEn: "Board Bazar", nameBn: "বোর্ড বাজার" },
      { nameEn: "Konabari", nameBn: "কোনাবাড়ী" },
      { nameEn: "Kashimpur", nameBn: "কাশিমপুর" }
    ]
  },
  {
    nameEn: "Narayanganj",
    nameBn: "নারায়ণগঞ্জ",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Narayanganj Sadar", nameBn: "নারায়ণগঞ্জ সদর" },
      { nameEn: "Bandar", nameBn: "বন্দর" },
      { nameEn: "Fatullah", nameBn: "ফতুল্লা" },
      { nameEn: "Siddhirganj", nameBn: "সিদ্ধিরগঞ্জ" },
      { nameEn: "Rupganj", nameBn: "রূপগঞ্জ" },
      { nameEn: "Sonargaon", nameBn: "সোনারগাঁও" },
      { nameEn: "Araihazar", nameBn: "আড়াইহাজার" }
    ]
  },
  {
    nameEn: "Sylhet",
    nameBn: "সিলেট",
    isDhaka: false,
    division: "Sylhet",
    thanas: [
      { nameEn: "Sylhet Sadar", nameBn: "সিলেট সদর" },
      { nameEn: "Kotwali", nameBn: "কোতোয়ালী" },
      { nameEn: "South Surma", nameBn: "দক্ষিণ সুরমা" },
      { nameEn: "Shah Poran", nameBn: "শাহপরাণ" },
      { nameEn: "Beanibazar", nameBn: "বিয়ানীবাজার" },
      { nameEn: "Golapganj", nameBn: "গোলাপগঞ্জ" },
      { nameEn: "Biswanath", nameBn: "বিশ্বনাথ" },
      { nameEn: "Balaganj", nameBn: "বালাগঞ্জ" },
      { nameEn: "Fenchuganj", nameBn: "ফেঞ্চুগঞ্জ" },
      { nameEn: "Jaintiapur", nameBn: "জৈন্তাপুর" },
      { nameEn: "Kanaighat", nameBn: "কানাইঘাট" },
      { nameEn: "Companiganj", nameBn: "কোম্পানীগঞ্জ" },
      { nameEn: "Gowainghat", nameBn: "গোয়াইনঘাট" },
      { nameEn: "Zakiganj", nameBn: "জকিগঞ্জ" },
      { nameEn: "Osmani Nagar", nameBn: "ওসমানী নগর" }
    ]
  },
  {
    nameEn: "Rajshahi",
    nameBn: "রাজশাহী",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Boalia", nameBn: "বোয়ালিয়া" },
      { nameEn: "Rajpara", nameBn: "রাজপাড়া" },
      { nameEn: "Motihar", nameBn: "মতিহার" },
      { nameEn: "Shah Makhdum", nameBn: "শাহ মখদুম" },
      { nameEn: "Chandrima", nameBn: "চন্দ্রিমা" },
      { nameEn: "Kashiadanga", nameBn: "কাশিয়াডাঙ্গা" },
      { nameEn: "Katakhali", nameBn: "কাটাখালী" },
      { nameEn: "Paba", nameBn: "পবা" },
      { nameEn: "Bagha", nameBn: "বাঘা" },
      { nameEn: "Charghat", nameBn: "চারঘাট" },
      { nameEn: "Durgapur", nameBn: "দুর্গাপুর" },
      { nameEn: "Godagari", nameBn: "গোদাগাড়ী" },
      { nameEn: "Mohanpur", nameBn: "মোহনপুর" },
      { nameEn: "Puthia", nameBn: "পুঠিয়া" },
      { nameEn: "Tanore", nameBn: "তানোর" },
      { nameEn: "Bagmara", nameBn: "বাগমারা" }
    ]
  },
  {
    nameEn: "Khulna",
    nameBn: "খুলনা",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Khulna Sadar", nameBn: "খুলনা সদর" },
      { nameEn: "Sonadanga", nameBn: "সোনাডাঙ্গা" },
      { nameEn: "Khalishpur", nameBn: "খালিশপুর" },
      { nameEn: "Daulatpur", nameBn: "দৌলতপুর" },
      { nameEn: "Khan Jahan Ali", nameBn: "খান জাহান আলী" },
      { nameEn: "Aranghata", nameBn: "আড়ংঘাটা" },
      { nameEn: "Horintana", nameBn: "হরিণটানা" },
      { nameEn: "Batiaghata", nameBn: "বটিয়াঘাটা" },
      { nameEn: "Dacope", nameBn: "দাকোপ" },
      { nameEn: "Dumuria", nameBn: "ডুমুরিয়া" },
      { nameEn: "Dighalia", nameBn: "দিঘলিয়া" },
      { nameEn: "Koyra", nameBn: "কয়রা" },
      { nameEn: "Paikgachha", nameBn: "পাইকগাছা" },
      { nameEn: "Phultala", nameBn: "ফুলতলা" },
      { nameEn: "Rupsha", nameBn: "রূপসা" },
      { nameEn: "Terokhada", nameBn: "তেরখাদা" }
    ]
  },
  {
    nameEn: "Barishal",
    nameBn: "বরিশাল",
    isDhaka: false,
    division: "Barishal",
    thanas: [
      { nameEn: "Kotwali / Sadar", nameBn: "কোতোয়ালী / সদর" },
      { nameEn: "Airport", nameBn: "বিমানবন্দর" },
      { nameEn: "Kawnia", nameBn: "কাউনিয়া" },
      { nameEn: "Babuganj", nameBn: "বাবুগঞ্জ" },
      { nameEn: "Bakerganj", nameBn: "বাকেরগঞ্জ" },
      { nameEn: "Banaripara", nameBn: "বানারীপাড়া" },
      { nameEn: "Gaurnadi", nameBn: "গৌরনদী" },
      { nameEn: "Hizla", nameBn: "হিজলা" },
      { nameEn: "Mehendiganj", nameBn: "মেহেন্দিগঞ্জ" },
      { nameEn: "Muladi", nameBn: "মুলাদী" },
      { nameEn: "Wazirpur", nameBn: "উজিরপুর" },
      { nameEn: "Agailjhara", nameBn: "আগৈলঝাড়া" }
    ]
  },
  {
    nameEn: "Rangpur",
    nameBn: "রংপুর",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Kotwali / Sadar", nameBn: "কোতোয়ালী / সদর" },
      { nameEn: "Badarganj", nameBn: "বদরগঞ্জ" },
      { nameEn: "Gangachhara", nameBn: "গঙ্গাচড়া" },
      { nameEn: "Kaunia", nameBn: "কাউনিয়া" },
      { nameEn: "Mithapukur", nameBn: "মিঠাপুকুর" },
      { nameEn: "Pirgachha", nameBn: "পীরগাছা" },
      { nameEn: "Pirganj", nameBn: "পীরগঞ্জ" },
      { nameEn: "Taraganj", nameBn: "তারাগঞ্জ" },
      { nameEn: "Haragach", nameBn: "হারাগাছ" }
    ]
  },
  {
    nameEn: "Mymensingh",
    nameBn: "ময়মনসিংহ",
    isDhaka: false,
    division: "Mymensingh",
    thanas: [
      { nameEn: "Kotwali / Sadar", nameBn: "কোতোয়ালী / সদর" },
      { nameEn: "Bhaluka", nameBn: "ভালুকা" },
      { nameEn: "Trishal", nameBn: "ত্রিশাল" },
      { nameEn: "Muktagachha", nameBn: "মুক্তাগাছা" },
      { nameEn: "Fulbaria", nameBn: "ফুলবাড়িয়া" },
      { nameEn: "Gafargaon", nameBn: "গফরগাঁও" },
      { nameEn: "Gauripur", nameBn: "গৌরীপুর" },
      { nameEn: "Ishwarganj", nameBn: "ঈশ্বরগঞ্জ" },
      { nameEn: "Haluaghat", nameBn: "কালুয়াঘাট" },
      { nameEn: "Dhobaura", nameBn: "ধোবাউড়া" },
      { nameEn: "Nandail", nameBn: "নান্দাইল" },
      { nameEn: "Phulpur", nameBn: "ফুলপুর" },
      { nameEn: "Tara Khanda", nameBn: "তারাকান্দা" }
    ]
  },
  {
    nameEn: "Cumilla",
    nameBn: "কুমিল্লা",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Cumilla Adarsha Sadar", nameBn: "আদর্শ সদর" },
      { nameEn: "Cumilla Sadar Dakshin", nameBn: "সদর দক্ষিণ" },
      { nameEn: "Barura", nameBn: "বরুড়া" },
      { nameEn: "Brahmanpara", nameBn: "ব্রাহ্মণপাড়া" },
      { nameEn: "Burichang", nameBn: "বুড়িচং" },
      { nameEn: "Chandina", nameBn: "চান্দিনা" },
      { nameEn: "Chauddagram", nameBn: "চৌদ্দগ্রাম" },
      { nameEn: "Daudkandi", nameBn: "দাউদকান্দি" },
      { nameEn: "Debidwar", nameBn: "দেবিদ্বার" },
      { nameEn: "Homna", nameBn: "হোমনা" },
      { nameEn: "Laksam", nameBn: "লাকসাম" },
      { nameEn: "Muradnagar", nameBn: "মুরাদনগর" },
      { nameEn: "Nangalkot", nameBn: "নাঙ্গলকোট" },
      { nameEn: "Meghna", nameBn: "মেঘনা" },
      { nameEn: "Titas", nameBn: "তিতাস" },
      { nameEn: "Monohargonj", nameBn: "মনোহরগঞ্জ" },
      { nameEn: "Lalmai", nameBn: "লালমাই" }
    ]
  },
  {
    nameEn: "Bogura",
    nameBn: "বগুড়া",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Bogura Sadar", nameBn: "বগুড়া সদর" },
      { nameEn: "Adamdighi", nameBn: "আদমদীঘি" },
      { nameEn: "Dhunat", nameBn: "ধুনট" },
      { nameEn: "Dhupchanchia", nameBn: "দুপচাঁচিয়া" },
      { nameEn: "Gabtali", nameBn: "গাবতলী" },
      { nameEn: "Kahaloo", nameBn: "কাহালু" },
      { nameEn: "Nandigram", nameBn: "নন্দীগ্রাম" },
      { nameEn: "Sariakandi", nameBn: "সারিয়াকান্দি" },
      { nameEn: "Sahajanpur", nameBn: "শাজাহানপুর" },
      { nameEn: "Sherpur", nameBn: "শেরপুর" },
      { nameEn: "Shibganj", nameBn: "শিবগঞ্জ" },
      { nameEn: "Sonatala", nameBn: "সোনাতলা" }
    ]
  },
  {
    nameEn: "Cox's Bazar",
    nameBn: "কক্সবাজার",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Cox's Bazar Sadar", nameBn: "কক্সবাজার সদর" },
      { nameEn: "Chakaria", nameBn: "চকোরিয়া" },
      { nameEn: "Kutubdia", nameBn: "কুতুবদিয়া" },
      { nameEn: "Maheshkhali", nameBn: "মহেশখালী" },
      { nameEn: "Ramu", nameBn: "রামু" },
      { nameEn: "Teknaf", nameBn: "টেকনাফ" },
      { nameEn: "Ukhia", nameBn: "উখিয়া" },
      { nameEn: "Pekua", nameBn: "পেকুয়া" },
      { nameEn: "Eidgaon", nameBn: "ঈদগাঁও" }
    ]
  },
  {
    nameEn: "Narsingdi",
    nameBn: "নরসিংদী",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Narsingdi Sadar", nameBn: "নরসিংদী সদর" },
      { nameEn: "Belabo", nameBn: "বেলাবো" },
      { nameEn: "Monohardi", nameBn: "মনোহরদী" },
      { nameEn: "Palash", nameBn: "পলাশ" },
      { nameEn: "Raipura", nameBn: "রায়পুরা" },
      { nameEn: "Shibpur", nameBn: "শিবপুর" }
    ]
  },
  {
    nameEn: "Tangail",
    nameBn: "টাঙ্গাইল",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Tangail Sadar", nameBn: "টাঙ্গাইল সদর" },
      { nameEn: "Basail", nameBn: "বাসাইল" },
      { nameEn: "Bhuapur", nameBn: "ভুয়াপুর" },
      { nameEn: "Delduar", nameBn: "দেলদুয়ার" },
      { nameEn: "Ghatail", nameBn: "ঘাটাইল" },
      { nameEn: "Gopalpur", nameBn: "গোপালপুর" },
      { nameEn: "Kalihati", nameBn: "কালিহাতী" },
      { nameEn: "Madhupur", nameBn: "মধুপুর" },
      { nameEn: "Mirzapur", nameBn: "মির্জাপুর" },
      { nameEn: "Nagarpur", nameBn: "নাগরপুর" },
      { nameEn: "Sakhipur", nameBn: "সখিপুর" },
      { nameEn: "Dhanbari", nameBn: "ধনবাড়ী" }
    ]
  },
  {
    nameEn: "Feni",
    nameBn: "ফেনী",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Feni Sadar", nameBn: "ফেনী সদর" },
      { nameEn: "Chhagalnaiya", nameBn: "ছাগলনাইয়া" },
      { nameEn: "Daganbhuiyan", nameBn: "দাগনভূঞা" },
      { nameEn: "Parshuram", nameBn: "পরশুরাম" },
      { nameEn: "Fulgazi", nameBn: "ফুলগাজী" },
      { nameEn: "Sonagazi", nameBn: "সোনাগাজী" }
    ]
  },
  {
    nameEn: "Noakhali",
    nameBn: "নোয়াখালী",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Noakhali Sadar (Sudharam)", nameBn: "নোয়াখালী সদর (সুধারাম)" },
      { nameEn: "Begumganj", nameBn: "বেগমগঞ্জ" },
      { nameEn: "Chatkhil", nameBn: "চাটখিল" },
      { nameEn: "Companiganj", nameBn: "কোম্পানীগঞ্জ" },
      { nameEn: "Hatiya", nameBn: "হাতিয়া" },
      { nameEn: "Senbagh", nameBn: "সেনবাগ" },
      { nameEn: "Sonaimuri", nameBn: "সোনাইমুড়ী" },
      { nameEn: "Subarnachar", nameBn: "সুবর্ণচর" },
      { nameEn: "Kabirhat", nameBn: "কবিরহাট" }
    ]
  },
  {
    nameEn: "Brahmanbaria",
    nameBn: "ব্রাহ্মণবাড়িয়া",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Brahmanbaria Sadar", nameBn: "ব্রাহ্মণবাড়িয়া সদর" },
      { nameEn: "Ashuganj", nameBn: "আশুগঞ্জ" },
      { nameEn: "Akhaura", nameBn: "আখাউড়া" },
      { nameEn: "Bancharampur", nameBn: "বাঞ্ছারামপুর" },
      { nameEn: "Kasba", nameBn: "কসবা" },
      { nameEn: "Nabinagar", nameBn: "নবীনগর" },
      { nameEn: "Nasirnagar", nameBn: "নাসিরনগর" },
      { nameEn: "Sarail", nameBn: "সরাইল" },
      { nameEn: "Bijoynagar", nameBn: "বিজয়নগর" }
    ]
  },
  {
    nameEn: "Chandpur",
    nameBn: "চাঁদপুর",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Chandpur Sadar", nameBn: "চাঁদপুর সদর" },
      { nameEn: "Faridganj", nameBn: "ফরিদগঞ্জ" },
      { nameEn: "Haimchar", nameBn: "হাইমচর" },
      { nameEn: "Haziganj", nameBn: "হাজীগঞ্জ" },
      { nameEn: "Kachua", nameBn: "কচুয়া" },
      { nameEn: "Matlab Dakshin", nameBn: "মতলব দক্ষিণ" },
      { nameEn: "Matlab Uttar", nameBn: "মতলব উত্তর" },
      { nameEn: "Shahrasti", nameBn: "শাহরাস্তি" }
    ]
  },
  {
    nameEn: "Jashore",
    nameBn: "যশোর",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Jashore Sadar (Kotwali)", nameBn: "যশোর সদর (কোতোয়ালী)" },
      { nameEn: "Abhaynagar", nameBn: "অভয়নগর" },
      { nameEn: "Bagherpara", nameBn: "বাঘারপাড়া" },
      { nameEn: "Chaugachha", nameBn: "চৌগাছা" },
      { nameEn: "Jhikargachha", nameBn: "ঝিকরগাছা" },
      { nameEn: "Keshabpur", nameBn: "কেশবপুর" },
      { nameEn: "Manirampur", nameBn: "মণিরামপুর" },
      { nameEn: "Sharsha", nameBn: "শার্শা" },
      { nameEn: "Benapole", nameBn: "বেনাপোল" }
    ]
  },
  {
    nameEn: "Kushtia",
    nameBn: "কুষ্টিয়া",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Kushtia Sadar", nameBn: "কুষ্টিয়া সদর" },
      { nameEn: "Bheramara", nameBn: "ভেড়ামারা" },
      { nameEn: "Daulatpur", nameBn: "দৌলতপুর" },
      { nameEn: "Khoksa", nameBn: "খোকসা" },
      { nameEn: "Kumarkhali", nameBn: "কুমারখালী" },
      { nameEn: "Mirpur", nameBn: "মিরপুর" },
      { nameEn: "Islamic University", nameBn: "ইসলামী বিশ্ববিদ্যালয়" }
    ]
  },
  {
    nameEn: "Pabna",
    nameBn: "পাবনা",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Pabna Sadar", nameBn: "পাবনা সদর" },
      { nameEn: "Atgharia", nameBn: "আটঘরিয়া" },
      { nameEn: "Bera", nameBn: "বেড়া" },
      { nameEn: "Bhangura", nameBn: "ভাঙ্গুড়া" },
      { nameEn: "Chatmohar", nameBn: "চাটমোহর" },
      { nameEn: "Faridpur", nameBn: "ফরিদপুর" },
      { nameEn: "Ishwardi", nameBn: "ঈশ্বরদী" },
      { nameEn: "Santhia", nameBn: "সাঁথিয়া" },
      { nameEn: "Sujanagar", nameBn: "সুজানগর" }
    ]
  },
  {
    nameEn: "Dinajpur",
    nameBn: "দিনাজপুর",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Dinajpur Sadar (Kotwali)", nameBn: "দিনাজপুর সদর (কোতোয়ালী)" },
      { nameEn: "Birampur", nameBn: "বিরামপুর" },
      { nameEn: "Birganj", nameBn: "বীরগঞ্জ" },
      { nameEn: "Biral", nameBn: "বিরল" },
      { nameEn: "Bochaganj", nameBn: "বোচাগঞ্জ" },
      { nameEn: "Chirirbandar", nameBn: "চিরিরবন্দর" },
      { nameEn: "Phulbari", nameBn: "ফুলবাড়ী" },
      { nameEn: "Ghoraghat", nameBn: "ঘোড়াঘাট" },
      { nameEn: "Hakimpur", nameBn: "হাকিমপুর" },
      { nameEn: "Kaharole", nameBn: "কাহারোল" },
      { nameEn: "Khansama", nameBn: "খানসামা" },
      { nameEn: "Nawabganj", nameBn: "নবাবগঞ্জ" },
      { nameEn: "Parbatipur", nameBn: "পার্বতীপুর" }
    ]
  },
  {
    nameEn: "Faridpur",
    nameBn: "ফরিদপুর",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Faridpur Sadar (Kotwali)", nameBn: "ফরিদপুর সদর (কোতোয়ালী)" },
      { nameEn: "Alfadanga", nameBn: "আলফাডাঙ্গা" },
      { nameEn: "Bhanga", nameBn: "ভাঙ্গা" },
      { nameEn: "Boalmari", nameBn: "বোয়ালমারী" },
      { nameEn: "Charbhadrasan", nameBn: "চরভদ্রাসন" },
      { nameEn: "Madhukhali", nameBn: "মধুখালী" },
      { nameEn: "Nagarkanda", nameBn: "নগরকান্দা" },
      { nameEn: "Sadarpur", nameBn: "সদরপুর" },
      { nameEn: "Saltha", nameBn: "সালথা" }
    ]
  },
  {
    nameEn: "Bagerhat",
    nameBn: "বাগেরহাট",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Bagerhat Sadar", nameBn: "বাগেরহাট সদর" },
      { nameEn: "Chitalmari", nameBn: "চিতলমারী" },
      { nameEn: "Fakirhat", nameBn: "ফকিরহাট" },
      { nameEn: "Kachua", nameBn: "কচুয়া" },
      { nameEn: "Mollahat", nameBn: "মোল্লাহাট" },
      { nameEn: "Mongla", nameBn: "মংলা" },
      { nameEn: "Morrelganj", nameBn: "মোরেলগঞ্জ" },
      { nameEn: "Rampal", nameBn: "রামপাল" },
      { nameEn: "Sarankhola", nameBn: "শরণখোলা" }
    ]
  },
  {
    nameEn: "Bandarban",
    nameBn: "বান্দরবান",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Bandarban Sadar", nameBn: "বান্দরবান সদর" },
      { nameEn: "Alikadam", nameBn: "আলীকদম" },
      { nameEn: "Lama", nameBn: "লামা" },
      { nameEn: "Naikhongchhari", nameBn: "নাইক্ষ্যংছড়ি" },
      { nameEn: "Rowangchhari", nameBn: "রোয়াংছড়ি" },
      { nameEn: "Ruma", nameBn: "রুমা" },
      { nameEn: "Thanchi", nameBn: "থানচি" }
    ]
  },
  {
    nameEn: "Barguna",
    nameBn: "বরগুনা",
    isDhaka: false,
    division: "Barishal",
    thanas: [
      { nameEn: "Barguna Sadar", nameBn: "বরগুনা সদর" },
      { nameEn: "Amtali", nameBn: "আমতলী" },
      { nameEn: "Bamna", nameBn: "বামনা" },
      { nameEn: "Betagi", nameBn: "বেতাগী" },
      { nameEn: "Patharghata", nameBn: "পাথরঘাটা" },
      { nameEn: "Taltali", nameBn: "তালতলী" }
    ]
  },
  {
    nameEn: "Bhola",
    nameBn: "ভোলা",
    isDhaka: false,
    division: "Barishal",
    thanas: [
      { nameEn: "Bhola Sadar", nameBn: "ভোলা সদর" },
      { nameEn: "Burhanuddin", nameBn: "বোরহানউদ্দিন" },
      { nameEn: "Char Fasson", nameBn: "চরফ্যাশন" },
      { nameEn: "Daulatkhan", nameBn: "দৌলতখান" },
      { nameEn: "Lalmohan", nameBn: "লালমোহন" },
      { nameEn: "Manpura", nameBn: "মনপুরা" },
      { nameEn: "Tazumuddin", nameBn: "তজুমদ্দিন" }
    ]
  },
  {
    nameEn: "Chapainawabganj",
    nameBn: "চাঁপাইনবাবগঞ্জ",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Chapainawabganj Sadar", nameBn: "চাঁপাইনবাবগঞ্জ সদর" },
      { nameEn: "Bholahat", nameBn: "ভোলাহাট" },
      { nameEn: "Gomastapur", nameBn: "গোমস্তাপুর" },
      { nameEn: "Nachole", nameBn: "নাচোল" },
      { nameEn: "Shibganj", nameBn: "শিবগঞ্জ" }
    ]
  },
  {
    nameEn: "Chuadanga",
    nameBn: "চুয়াডাঙ্গা",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Chuadanga Sadar", nameBn: "চুয়াডাঙ্গা সদর" },
      { nameEn: "Alamdanga", nameBn: "আলমডাঙ্গা" },
      { nameEn: "Damurhuda", nameBn: "দামুড়হুদা" },
      { nameEn: "Jibannagar", nameBn: "জীবননগর" },
      { nameEn: "Darshana", nameBn: "দর্শনা" }
    ]
  },
  {
    nameEn: "Gaibandha",
    nameBn: "গাইবান্ধা",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Gaibandha Sadar", nameBn: "গাইবান্ধা সদর" },
      { nameEn: "Fulchhari", nameBn: "ফুলছড়ি" },
      { nameEn: "Gobindaganj", nameBn: "গোবিন্দগঞ্জ" },
      { nameEn: "Palashbari", nameBn: "পলাশবাড়ী" },
      { nameEn: "Sadullapur", nameBn: "সাদুল্লাপুর" },
      { nameEn: "Saghata", nameBn: "সাঘাটা" },
      { nameEn: "Sundarganj", nameBn: "সুন্দরগঞ্জ" }
    ]
  },
  {
    nameEn: "Gopalganj",
    nameBn: "গোপালগঞ্জ",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Gopalganj Sadar", nameBn: "গোপালগঞ্জ সদর" },
      { nameEn: "Kashiani", nameBn: "কাশিয়ানী" },
      { nameEn: "Kotalipara", nameBn: "কোটালীপাড়া" },
      { nameEn: "Muksudpur", nameBn: "মুকসুদপুর" },
      { nameEn: "Tungipara", nameBn: "টুঙ্গিপাড়া" }
    ]
  },
  {
    nameEn: "Habiganj",
    nameBn: "হবিগঞ্জ",
    isDhaka: false,
    division: "Sylhet",
    thanas: [
      { nameEn: "Habiganj Sadar", nameBn: "হবিগঞ্জ সদর" },
      { nameEn: "Ajmiriganj", nameBn: "আজমিরীগঞ্জ" },
      { nameEn: "Bahubal", nameBn: "বাহুবল" },
      { nameEn: "Baniachang", nameBn: "বানিয়াচং" },
      { nameEn: "Chunarughat", nameBn: "চুনারুঘাট" },
      { nameEn: "Lakhai", nameBn: "লাখাই" },
      { nameEn: "Madhabpur", nameBn: "মাধবপুর" },
      { nameEn: "Nabiganj", nameBn: "নবীগঞ্জ" },
      { nameEn: "Sayestaganj", nameBn: "শায়েস্তাগঞ্জ" }
    ]
  },
  {
    nameEn: "Jamalpur",
    nameBn: "জামালপুর",
    isDhaka: false,
    division: "Mymensingh",
    thanas: [
      { nameEn: "Jamalpur Sadar", nameBn: "জামালপুর সদর" },
      { nameEn: "Baksiganj", nameBn: "বকশীগঞ্জ" },
      { nameEn: "Dewanganj", nameBn: "দেওয়ানগঞ্জ" },
      { nameEn: "Islampur", nameBn: "ইসলামপুর" },
      { nameEn: "Madarganj", nameBn: "মাদারগঞ্জ" },
      { nameEn: "Melandaha", nameBn: "মেলান্দহ" },
      { nameEn: "Sarishabari", nameBn: "সরিষাবাড়ী" }
    ]
  },
  {
    nameEn: "Jhalokathi",
    nameBn: "ঝালকাঠি",
    isDhaka: false,
    division: "Barishal",
    thanas: [
      { nameEn: "Jhalokathi Sadar", nameBn: "ঝালকাঠি সদর" },
      { nameEn: "Kathalia", nameBn: "কাঠালিয়া" },
      { nameEn: "Nalchity", nameBn: "নলছিটি" },
      { nameEn: "Rajapur", nameBn: "রাজাপুর" }
    ]
  },
  {
    nameEn: "Jhenaidah",
    nameBn: "ঝিনাইদহ",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Jhenaidah Sadar", nameBn: "ঝিনাইদহ সদর" },
      { nameEn: "Harinakundu", nameBn: "হরিণাকুণ্ডু" },
      { nameEn: "Kaliganj", nameBn: "কালীগঞ্জ" },
      { nameEn: "Kotchandpur", nameBn: "কোটচাঁদপুর" },
      { nameEn: "Maheshpur", nameBn: "মহেশপুর" },
      { nameEn: "Shailkupa", nameBn: "শৈলকুপা" }
    ]
  },
  {
    nameEn: "Joypurhat",
    nameBn: "জয়পুরহাট",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Joypurhat Sadar", nameBn: "জয়পুরহাট সদর" },
      { nameEn: "Akkelpur", nameBn: "আক্কেলপুর" },
      { nameEn: "Kalai", nameBn: "কালাই" },
      { nameEn: "Khetlal", nameBn: "ক্ষেতলাল" },
      { nameEn: "Panchbibi", nameBn: "পাঁচবিবি" }
    ]
  },
  {
    nameEn: "Khagrachhari",
    nameBn: "খাগড়াছড়ি",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Khagrachhari Sadar", nameBn: "খাগড়াছড়ি সদর" },
      { nameEn: "Dighinala", nameBn: "দীঘিনালা" },
      { nameEn: "Lakshmichhari", nameBn: "লক্ষ্মীছড়ি" },
      { nameEn: "Mahalchhari", nameBn: "মহালছড়ি" },
      { nameEn: "Manikchhari", nameBn: "মানিকছড়ি" },
      { nameEn: "Matiranga", nameBn: "মাটিরাঙ্গা" },
      { nameEn: "Panchhari", nameBn: "পানছড়ি" },
      { nameEn: "Ramgarh", nameBn: "রামগড়" },
      { nameEn: "Guimara", nameBn: "গুইমারা" }
    ]
  },
  {
    nameEn: "Kishoreganj",
    nameBn: "কিশোরগঞ্জ",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Kishoreganj Sadar", nameBn: "কিশোরগঞ্জ সদর" },
      { nameEn: "Austagram", nameBn: "অষ্টগ্রাম" },
      { nameEn: "Bajitpur", nameBn: "বাজিতপুর" },
      { nameEn: "Bhairab", nameBn: "ভৈরব" },
      { nameEn: "Hossainpur", nameBn: "হোসেনপুর" },
      { nameEn: "Itna", nameBn: "ইটনা" },
      { nameEn: "Karimganj", nameBn: "করিমগঞ্জ" },
      { nameEn: "Katiadi", nameBn: "কটিয়াদী" },
      { nameEn: "Kuliarchar", nameBn: "কুলিয়ারচর" },
      { nameEn: "Mithamain", nameBn: "মিঠামইন" },
      { nameEn: "Nikli", nameBn: "নিকলী" },
      { nameEn: "Pakundia", nameBn: "পাকুন্দিয়া" },
      { nameEn: "Tarail", nameBn: "তাড়াইল" }
    ]
  },
  {
    nameEn: "Kurigram",
    nameBn: "কুড়িগ্রাম",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Kurigram Sadar", nameBn: "কুড়িগ্রাম সদর" },
      { nameEn: "Bhurungamari", nameBn: "ভুরুঙ্গামারী" },
      { nameEn: "Char Rajibpur", nameBn: "চর রাজিবপুর" },
      { nameEn: "Chilmari", nameBn: "চিলমারী" },
      { nameEn: "Phulbari", nameBn: "ফুলবাড়ী" },
      { nameEn: "Nageshwari", nameBn: "নাগেশ্বরী" },
      { nameEn: "Rajarhat", nameBn: "রাজারহাট" },
      { nameEn: "Rowmari", nameBn: "রৌমারী" },
      { nameEn: "Ulipur", nameBn: "উলিপুর" }
    ]
  },
  {
    nameEn: "Lakshmipur",
    nameBn: "লক্ষ্মীপুর",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Lakshmipur Sadar", nameBn: "লক্ষ্মীপুর সদর" },
      { nameEn: "Raipur", nameBn: "রায়পুর" },
      { nameEn: "Ramganj", nameBn: "রামগঞ্জ" },
      { nameEn: "Ramgati", nameBn: "রামগতি" },
      { nameEn: "Kamalnagar", nameBn: "কমলনগর" }
    ]
  },
  {
    nameEn: "Lalmonirhat",
    nameBn: "লালমনিরহাট",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Lalmonirhat Sadar", nameBn: "লালমনিরহাট সদর" },
      { nameEn: "Aditmari", nameBn: "আদিতমারী" },
      { nameEn: "Hatibandha", nameBn: "হাতীবান্ধা" },
      { nameEn: "Kaliganj", nameBn: "কালীগঞ্জ" },
      { nameEn: "Patgram", nameBn: "পাটগ্রাম" }
    ]
  },
  {
    nameEn: "Madaripur",
    nameBn: "মাদারীপুর",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Madaripur Sadar", nameBn: "মাদারীপুর সদর" },
      { nameEn: "Kalkini", nameBn: "কালকিনি" },
      { nameEn: "Rajoir", nameBn: "রাজৈর" },
      { nameEn: "Shibchar", nameBn: "শিবচর" },
      { nameEn: "Dasar", nameBn: "ডাসার" }
    ]
  },
  {
    nameEn: "Magura",
    nameBn: "মাগুরা",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Magura Sadar", nameBn: "মাগুরা সদর" },
      { nameEn: "Mohammadpur", nameBn: "মোহাম্মদপুর" },
      { nameEn: "Shalikha", nameBn: "শালিখা" },
      { nameEn: "Sreepur", nameBn: "শ্রীপুর" }
    ]
  },
  {
    nameEn: "Manikganj",
    nameBn: "মানিকগঞ্জ",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Manikganj Sadar", nameBn: "মানিকগঞ্জ সদর" },
      { nameEn: "Daulatpur", nameBn: "দৌলতপুর" },
      { nameEn: "Ghior", nameBn: "ঘিওর" },
      { nameEn: "Harirampur", nameBn: "হরিরামপুর" },
      { nameEn: "Saturia", nameBn: "সাটুরিয়া" },
      { nameEn: "Shivalaya", nameBn: "শিবালয়" },
      { nameEn: "Singair", nameBn: "সিংগাইর" }
    ]
  },
  {
    nameEn: "Meherpur",
    nameBn: "মেহেরপুর",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Meherpur Sadar", nameBn: "মেহেরপুর সদর" },
      { nameEn: "Gangni", nameBn: "গাংনী" },
      { nameEn: "Mujibnagar", nameBn: "মুজিবনগর" }
    ]
  },
  {
    nameEn: "Moulvibazar",
    nameBn: "মৌলভীবাজার",
    isDhaka: false,
    division: "Sylhet",
    thanas: [
      { nameEn: "Moulvibazar Sadar", nameBn: "মৌলভীবাজার সদর" },
      { nameEn: "Barlekha", nameBn: "বড়লেখা" },
      { nameEn: "Kamalganj", nameBn: "কমলগঞ্জ" },
      { nameEn: "Kulaura", nameBn: "কুলাউড়া" },
      { nameEn: "Rajnagar", nameBn: "রাজনগর" },
      { nameEn: "Sreemangal", nameBn: "শ্রীমঙ্গল" },
      { nameEn: "Juri", nameBn: "জুড়ী" }
    ]
  },
  {
    nameEn: "Munshiganj",
    nameBn: "মুন্সীগঞ্জ",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Munshiganj Sadar", nameBn: "মুন্সীগঞ্জ সদর" },
      { nameEn: "Gazaria", nameBn: "গজারিয়া" },
      { nameEn: "Lohajang", nameBn: "লৌহজং" },
      { nameEn: "Sirajdikhan", nameBn: "সিরাজদিখান" },
      { nameEn: "Sreenagar", nameBn: "শ্রীনগর" },
      { nameEn: "Tongibari", nameBn: "টঙ্গীবাড়ি" }
    ]
  },
  {
    nameEn: "Naogaon",
    nameBn: "নওগাঁ",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Naogaon Sadar", nameBn: "নওগাঁ সদর" },
      { nameEn: "Atrai", nameBn: "আত্রাই" },
      { nameEn: "Badalgachhi", nameBn: "বদলগাছী" },
      { nameEn: "Dhamoirhat", nameBn: "ধামইরহাট" },
      { nameEn: "Manda", nameBn: "মান্দা" },
      { nameEn: "Mohadevpur", nameBn: "মহাদেবপুর" },
      { nameEn: "Niamatpur", nameBn: "নিয়ামতপুর" },
      { nameEn: "Patnitala", nameBn: "পত্নীতলা" },
      { nameEn: "Porsha", nameBn: "পোরশা" },
      { nameEn: "Raninagar", nameBn: "রাণীনগর" },
      { nameEn: "Sapahar", nameBn: "সাপাহার" }
    ]
  },
  {
    nameEn: "Narail",
    nameBn: "নড়াইল",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Narail Sadar", nameBn: "নড়াইল সদর" },
      { nameEn: "Kalia", nameBn: "কালিয়া" },
      { nameEn: "Lohagara", nameBn: "লোহাগাড়া" },
      { nameEn: "Naragati", nameBn: "নড়াগাতী" }
    ]
  },
  {
    nameEn: "Natore",
    nameBn: "নাটোর",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Natore Sadar", nameBn: "নাটোর সদর" },
      { nameEn: "Bagatipara", nameBn: "বাগাতিপাড়া" },
      { nameEn: "Baraigram", nameBn: "বড়াইগ্রাম" },
      { nameEn: "Gurudaspur", nameBn: "গুরুদাসপুর" },
      { nameEn: "Lalpur", nameBn: "লালপুর" },
      { nameEn: "Singra", nameBn: "সিংড়া" },
      { nameEn: "Naldanga", nameBn: "নলডাঙ্গা" }
    ]
  },
  {
    nameEn: "Netrokona",
    nameBn: "নেত্রকোণা",
    isDhaka: false,
    division: "Mymensingh",
    thanas: [
      { nameEn: "Netrokona Sadar", nameBn: "নেত্রকোণা সদর" },
      { nameEn: "Atpara", nameBn: "আটপাড়া" },
      { nameEn: "Barhatta", nameBn: "বারহাট্টা" },
      { nameEn: "Durgapur", nameBn: "দুর্গাপুর" },
      { nameEn: "Khaliajuri", nameBn: "খালিয়াজুড়ী" },
      { nameEn: "Kalmakanda", nameBn: "কলমাকান্দা" },
      { nameEn: "Kendua", nameBn: "কেন্দুয়া" },
      { nameEn: "Madan", nameBn: "মদন" },
      { nameEn: "Mohanganj", nameBn: "মোহনগঞ্জ" },
      { nameEn: "Purbadhala", nameBn: "পূর্বধলা" }
    ]
  },
  {
    nameEn: "Nilphamari",
    nameBn: "নীলফামারী",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Nilphamari Sadar", nameBn: "নীলফামারী সদর" },
      { nameEn: "Dimla", nameBn: "ডিমলা" },
      { nameEn: "Domar", nameBn: "ডোমার" },
      { nameEn: "Jaldhaka", nameBn: "জলঢাকা" },
      { nameEn: "Kishoreganj", nameBn: "কিশোরগঞ্জ" },
      { nameEn: "Saidpur", nameBn: "সৈয়দপুর" }
    ]
  },
  {
    nameEn: "Panchagarh",
    nameBn: "পঞ্চগড়",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Panchagarh Sadar", nameBn: "পঞ্চগড় সদর" },
      { nameEn: "Atwari", nameBn: "আটোয়ারী" },
      { nameEn: "Boda", nameBn: "বোদা" },
      { nameEn: "Debiganj", nameBn: "দেবীগঞ্জ" },
      { nameEn: "Tetulia", nameBn: "তেঁতুলিয়া" }
    ]
  },
  {
    nameEn: "Patuakhali",
    nameBn: "পটুয়াখালী",
    isDhaka: false,
    division: "Barishal",
    thanas: [
      { nameEn: "Patuakhali Sadar", nameBn: "পটুয়াখালী সদর" },
      { nameEn: "Bauphal", nameBn: "বাউফল" },
      { nameEn: "Dashmina", nameBn: "দশমিনা" },
      { nameEn: "Galachipa", nameBn: "গলাচিপা" },
      { nameEn: "Kalapara / Kuakata", nameBn: "কলাপাড়া / কুয়াকাটা" },
      { nameEn: "Mirzaganj", nameBn: "মির্জাগঞ্জ" },
      { nameEn: "Dumki", nameBn: "দুমকি" },
      { nameEn: "Rangabali", nameBn: "রাঙ্গাবালী" }
    ]
  },
  {
    nameEn: "Pirojpur",
    nameBn: "পিরোজপুর",
    isDhaka: false,
    division: "Barishal",
    thanas: [
      { nameEn: "Pirojpur Sadar", nameBn: "পিরোজপুর সদর" },
      { nameEn: "Bhandaria", nameBn: "ভাণ্ডারিয়া" },
      { nameEn: "Kawkhali", nameBn: "কাউখালী" },
      { nameEn: "Mathbaria", nameBn: "মঠবাড়িয়া" },
      { nameEn: "Nazirpur", nameBn: "নাজিরপুর" },
      { nameEn: "Nesarabad (Swarupkati)", nameBn: "নেছারাবাদ (স্বরূপকাঠি)" },
      { nameEn: "Zianagar (Indurkani)", nameBn: "ইন্দুরকানী" }
    ]
  },
  {
    nameEn: "Rajbari",
    nameBn: "রাজবাড়ী",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Rajbari Sadar", nameBn: "রাজবাড়ী সদর" },
      { nameEn: "Baliakandi", nameBn: "বালিয়াকান্দি" },
      { nameEn: "Goalandaghat", nameBn: "গোয়ালন্দ ঘাট" },
      { nameEn: "Pangsha", nameBn: "পাংশা" },
      { nameEn: "Kalukhali", nameBn: "কালুখালী" }
    ]
  },
  {
    nameEn: "Rangamati",
    nameBn: "রাঙ্গামাটি",
    isDhaka: false,
    division: "Chattogram",
    thanas: [
      { nameEn: "Rangamati Sadar (Kotwali)", nameBn: "রাঙ্গামাটি সদর (কোতোয়ালী)" },
      { nameEn: "Bagaichhari", nameBn: "বাঘাইছড়ি" },
      { nameEn: "Barkal", nameBn: "বরকল" },
      { nameEn: "Belaichhari", nameBn: "বিলাইছড়ি" },
      { nameEn: "Juraichhari", nameBn: "জুরাইছড়ি" },
      { nameEn: "Kaptai", nameBn: "কাপ্তাই" },
      { nameEn: "Kawkhali (Betbunia)", nameBn: "কাউখালী (বেতবুনিয়া)" },
      { nameEn: "Langadu", nameBn: "লংগদু" },
      { nameEn: "Naniarchar", nameBn: "নানিয়ারচর" },
      { nameEn: "Rajasthali", nameBn: "রাজস্থলী" }
    ]
  },
  {
    nameEn: "Satkhira",
    nameBn: "সাতক্ষীরা",
    isDhaka: false,
    division: "Khulna",
    thanas: [
      { nameEn: "Satkhira Sadar", nameBn: "সাতক্ষীরা সদর" },
      { nameEn: "Assasuni", nameBn: "আশাশুনি" },
      { nameEn: "Debhata", nameBn: "দেবহাটা" },
      { nameEn: "Kalaroa", nameBn: "কলারোয়া" },
      { nameEn: "Kaliganj", nameBn: "কালীগঞ্জ" },
      { nameEn: "Shyamnagar", nameBn: "শ্যামনগর" },
      { nameEn: "Tala", nameBn: "তালা" }
    ]
  },
  {
    nameEn: "Shariatpur",
    nameBn: "শরীয়তপুর",
    isDhaka: false,
    division: "Dhaka",
    thanas: [
      { nameEn: "Shariatpur Sadar (Palong)", nameBn: "শরীয়তপুর সদর (পালং)" },
      { nameEn: "Bhedarganj", nameBn: "ভেদরগঞ্জ" },
      { nameEn: "Damudya", nameBn: "ডামুড্যা" },
      { nameEn: "Gosairhat", nameBn: "গোসাইরহাট" },
      { nameEn: "Naria", nameBn: "নড়িয়া" },
      { nameEn: "Zajira", nameBn: "জাজিরা" },
      { nameEn: "Shakhipur", nameBn: "সখিপুর" }
    ]
  },
  {
    nameEn: "Sherpur",
    nameBn: "শেরপুর",
    isDhaka: false,
    division: "Mymensingh",
    thanas: [
      { nameEn: "Sherpur Sadar", nameBn: "শেরপুর সদর" },
      { nameEn: "Jhenaigati", nameBn: "ঝিনাইগাতী" },
      { nameEn: "Nakla", nameBn: "নকলা" },
      { nameEn: "Nalitabari", nameBn: "নালিতাবাড়ী" },
      { nameEn: "Sreebardi", nameBn: "শ্রীবরদী" }
    ]
  },
  {
    nameEn: "Sirajganj",
    nameBn: "সিরাজগঞ্জ",
    isDhaka: false,
    division: "Rajshahi",
    thanas: [
      { nameEn: "Sirajganj Sadar", nameBn: "সিরাজগঞ্জ সদর" },
      { nameEn: "Belkuchi", nameBn: "বেলকুচি" },
      { nameEn: "Chauhali", nameBn: "চৌহালী" },
      { nameEn: "Kamarkhanda", nameBn: "কামারখন্দ" },
      { nameEn: "Kazipur", nameBn: "কাজীপুর" },
      { nameEn: "Rayganj", nameBn: "রায়গঞ্জ" },
      { nameEn: "Shahjadpur", nameBn: "শাহজাদপুর" },
      { nameEn: "Tarash", nameBn: "তাড়াশ" },
      { nameEn: "Ullapara", nameBn: "উল্লাপাড়া" }
    ]
  },
  {
    nameEn: "Sunamganj",
    nameBn: "সুনামগঞ্জ",
    isDhaka: false,
    division: "Sylhet",
    thanas: [
      { nameEn: "Sunamganj Sadar", nameBn: "সুনামগঞ্জ সদর" },
      { nameEn: "Bishwamvarpur", nameBn: "বিশ্বম্ভরপুর" },
      { nameEn: "Chhatak", nameBn: "ছাতক" },
      { nameEn: "Derai", nameBn: "দিরাই" },
      { nameEn: "Dharampasha", nameBn: "ধর্মপাশা" },
      { nameEn: "Dowarabazar", nameBn: "দোয়ারাবাজার" },
      { nameEn: "Jagannathpur", nameBn: "জগন্নাথপুর" },
      { nameEn: "Jamalganj", nameBn: "জামালগঞ্জ" },
      { nameEn: "Sullah", nameBn: "শাল্লা" },
      { nameEn: "Tahirpur", nameBn: "তাহিরপুর" },
      { nameEn: "South Sunamganj (Shantiganj)", nameBn: "শান্তিগঞ্জ" },
      { nameEn: "Madhyanagar", nameBn: "মধ্যনগর" }
    ]
  },
  {
    nameEn: "Thakurgaon",
    nameBn: "ঠাকুরগাঁও",
    isDhaka: false,
    division: "Rangpur",
    thanas: [
      { nameEn: "Thakurgaon Sadar", nameBn: "ঠাকুরগাঁও সদর" },
      { nameEn: "Baliadangi", nameBn: "বালিয়াডাঙ্গী" },
      { nameEn: "Haripur", nameBn: "হরিপুর" },
      { nameEn: "Pirganj", nameBn: "পীরগঞ্জ" },
      { nameEn: "Ranisankail", nameBn: "রাণীশংকৈল" }
    ]
  }
];

export const bdDistricts = BD_DISTRICTS.map(d => d.nameEn);

/**
 * Returns list of thanas/upazilas for a given district name
 */
export function getThanasByDistrict(districtName: string): UpazilaInfo[] {
  if (!districtName) return [];
  const normalized = districtName.trim().toLowerCase();
  const district = BD_DISTRICTS.find(
    d => d.nameEn.toLowerCase() === normalized || d.nameBn.includes(districtName)
  );
  return district?.thanas || [];
}
