import type { Localized } from '../../i18n/i18n.model';
import type {
  DepartmentDto,
  HealthPackageDto,
  HospitalServiceDto,
  TestimonialDto,
} from '../../../shared/models/public.dto';

/**
 * Public-website content. The staff-side doctor rows (`DOCTOR_SEED`) hold the
 * operational data — fee, room, schedule; this file adds what a visitor reads.
 * Doctor counts and chamber times are derived in the handler, never duplicated.
 */

const l = (en: string, bn: string): Localized => ({ en, bn });

/** Staff `specialty` → public department slug. */
export const SPECIALTY_TO_DEPARTMENT: Readonly<Record<string, string>> = {
  Cardiology: 'cardiology',
  Obstetrics: 'gynae-obstetrics',
  Orthopaedics: 'orthopaedics',
  Paediatrics: 'paediatrics',
  'General Medicine': 'medicine',
  Dermatology: 'dermatology',
  Neurology: 'neurology',
  ENT: 'ent',
};

export const DEPARTMENT_SEED: readonly Omit<DepartmentDto, 'doctor_count'>[] = [
  {
    slug: 'cardiology',
    icon: 'heart-pulse',
    image: '/images/departments/cardiology.webp',
    name: l('Cardiology', 'কার্ডিওলজি'),
    summary: l(
      'Heart care from ECG and echo to cath-lab interventions.',
      'ইসিজি ও ইকো থেকে ক্যাথ-ল্যাব পর্যন্ত সম্পূর্ণ হৃদরোগ চিকিৎসা।',
    ),
    description: l(
      'Our cardiology team diagnoses and treats heart and blood-vessel disease, including hypertension, heart failure, rhythm disorders and coronary artery disease. A 24/7 coronary care unit and cath lab mean emergencies are handled in-house.',
      'আমাদের কার্ডিওলজি টিম উচ্চ রক্তচাপ, হার্ট ফেইলিউর, হৃদস্পন্দনের সমস্যা ও করোনারি আর্টারি ডিজিজসহ হৃদ্‌যন্ত্র ও রক্তনালির রোগ নির্ণয় ও চিকিৎসা করে। ২৪/৭ সিসিইউ ও ক্যাথ ল্যাব থাকায় জরুরি রোগীর চিকিৎসা হাসপাতালেই সম্ভব।',
    ),
    services: [
      l('ECG, Echo & ETT', 'ইসিজি, ইকো ও ইটিটি'),
      l('Coronary angiogram & stenting', 'করোনারি এনজিওগ্রাম ও স্টেন্টিং'),
      l('Pacemaker implantation', 'পেসমেকার স্থাপন'),
      l('24/7 CCU', '২৪/৭ সিসিইউ'),
    ],
  },
  {
    slug: 'gynae-obstetrics',
    icon: 'mother',
    image: '/images/departments/gynae-obstetrics.webp',
    name: l('Gynae & Obstetrics', 'গাইনি ও প্রসূতি'),
    summary: l(
      'Antenatal care, safe delivery and women’s health.',
      'গর্ভকালীন সেবা, নিরাপদ প্রসব ও নারী স্বাস্থ্য।',
    ),
    description: l(
      'From the first antenatal visit to postnatal follow-up, our obstetricians and midwives support mothers through every stage. The department also treats gynaecological conditions and offers laparoscopic surgery.',
      'প্রথম গর্ভকালীন চেকআপ থেকে প্রসব-পরবর্তী ফলোআপ পর্যন্ত আমাদের প্রসূতি বিশেষজ্ঞ ও মিডওয়াইফরা প্রতিটি ধাপে মায়ের পাশে থাকেন। এছাড়া গাইনি রোগের চিকিৎসা ও ল্যাপারোস্কোপিক সার্জারি করা হয়।',
    ),
    services: [
      l('Antenatal & postnatal care', 'গর্ভকালীন ও প্রসব-পরবর্তী সেবা'),
      l('Normal & caesarean delivery', 'নরমাল ও সিজারিয়ান ডেলিভারি'),
      l('Laparoscopic surgery', 'ল্যাপারোস্কোপিক সার্জারি'),
      l('Infertility counselling', 'বন্ধ্যাত্ব পরামর্শ'),
    ],
  },
  {
    slug: 'orthopaedics',
    icon: 'bone',
    image: '/images/departments/orthopaedics.webp',
    name: l('Orthopaedics', 'অর্থোপেডিক্স'),
    summary: l(
      'Bones, joints, spine and sports injuries.',
      'হাড়, জয়েন্ট, মেরুদণ্ড ও খেলাধুলাজনিত আঘাত।',
    ),
    description: l(
      'The orthopaedics department treats fractures, arthritis, spine problems and sports injuries, with joint replacement and arthroscopic surgery backed by an in-house physiotherapy unit.',
      'অর্থোপেডিক্স বিভাগ হাড় ভাঙা, আর্থ্রাইটিস, মেরুদণ্ডের সমস্যা ও খেলাধুলাজনিত আঘাতের চিকিৎসা করে। জয়েন্ট রিপ্লেসমেন্ট ও আর্থ্রোস্কোপিক সার্জারির পাশাপাশি নিজস্ব ফিজিওথেরাপি ইউনিট রয়েছে।',
    ),
    services: [
      l('Fracture management', 'হাড় ভাঙার চিকিৎসা'),
      l('Knee & hip replacement', 'হাঁটু ও হিপ রিপ্লেসমেন্ট'),
      l('Arthroscopy', 'আর্থ্রোস্কোপি'),
      l('Physiotherapy', 'ফিজিওথেরাপি'),
    ],
  },
  {
    slug: 'paediatrics',
    icon: 'baby',
    image: '/images/departments/paediatrics.webp',
    name: l('Paediatrics', 'শিশু বিভাগ'),
    summary: l(
      'Care for newborns, children and adolescents.',
      'নবজাতক, শিশু ও কিশোরদের চিকিৎসা।',
    ),
    description: l(
      'Our paediatricians look after children from birth to adolescence: vaccinations, growth monitoring, childhood illness and a level-III NICU for newborns who need intensive care.',
      'আমাদের শিশু বিশেষজ্ঞরা জন্ম থেকে কৈশোর পর্যন্ত শিশুদের যত্ন নেন: টিকা, বৃদ্ধি পর্যবেক্ষণ, শিশুরোগ এবং নিবিড় পরিচর্যার প্রয়োজন এমন নবজাতকদের জন্য লেভেল-৩ এনআইসিইউ।',
    ),
    services: [
      l('Vaccination', 'টিকাদান'),
      l('NICU', 'এনআইসিইউ'),
      l('Growth & development clinic', 'বৃদ্ধি ও বিকাশ ক্লিনিক'),
      l('Child nutrition', 'শিশু পুষ্টি'),
    ],
  },
  {
    slug: 'medicine',
    icon: 'stethoscope',
    image: '/images/departments/medicine.webp',
    name: l('Internal Medicine', 'মেডিসিন'),
    summary: l(
      'Diabetes, blood pressure, fever and chronic disease.',
      'ডায়াবেটিস, উচ্চ রক্তচাপ, জ্বর ও দীর্ঘমেয়াদি রোগ।',
    ),
    description: l(
      'Internal medicine is often the first stop. Our physicians diagnose and manage diabetes, hypertension, infections, thyroid and other chronic conditions, and refer on to specialists when needed.',
      'মেডিসিন বিভাগ প্রায়ই প্রথম ধাপ। আমাদের চিকিৎসকেরা ডায়াবেটিস, উচ্চ রক্তচাপ, সংক্রমণ, থাইরয়েড ও অন্যান্য দীর্ঘমেয়াদি রোগ নির্ণয় ও নিয়ন্ত্রণ করেন এবং প্রয়োজনে বিশেষজ্ঞের কাছে পাঠান।',
    ),
    services: [
      l('Diabetes clinic', 'ডায়াবেটিস ক্লিনিক'),
      l('Hypertension management', 'উচ্চ রক্তচাপ নিয়ন্ত্রণ'),
      l('Fever & infection', 'জ্বর ও সংক্রমণ'),
      l('Health check-ups', 'স্বাস্থ্য পরীক্ষা'),
    ],
  },
  {
    slug: 'dermatology',
    icon: 'sparkles',
    image: '/images/departments/dermatology.webp',
    name: l('Dermatology', 'চর্মরোগ'),
    summary: l(
      'Skin, hair and nail conditions.',
      'ত্বক, চুল ও নখের রোগ।',
    ),
    description: l(
      'Dermatologists here treat acne, eczema, psoriasis, fungal infections and hair loss, and offer minor skin procedures and laser treatment.',
      'এখানে চর্মরোগ বিশেষজ্ঞরা ব্রণ, একজিমা, সোরিয়াসিস, ছত্রাক সংক্রমণ ও চুল পড়ার চিকিৎসা করেন এবং ছোটখাটো ত্বকের প্রসিডিউর ও লেজার চিকিৎসা দেন।',
    ),
    services: [
      l('Acne & eczema', 'ব্রণ ও একজিমা'),
      l('Psoriasis', 'সোরিয়াসিস'),
      l('Hair loss treatment', 'চুল পড়ার চিকিৎসা'),
      l('Laser therapy', 'লেজার থেরাপি'),
    ],
  },
  {
    slug: 'neurology',
    icon: 'brain',
    image: '/images/departments/neurology.webp',
    name: l('Neurology', 'নিউরোলজি'),
    summary: l(
      'Stroke, epilepsy, headache and nerve disorders.',
      'স্ট্রোক, মৃগী, মাথাব্যথা ও স্নায়ুরোগ।',
    ),
    description: l(
      'The neurology department treats disorders of the brain, spine and nerves. A rapid stroke pathway, EEG and nerve-conduction studies are available on site.',
      'নিউরোলজি বিভাগ মস্তিষ্ক, মেরুদণ্ড ও স্নায়ুর রোগের চিকিৎসা করে। দ্রুত স্ট্রোক চিকিৎসা, ইইজি ও নার্ভ কন্ডাকশন পরীক্ষা হাসপাতালেই করা যায়।',
    ),
    services: [
      l('Stroke care', 'স্ট্রোক চিকিৎসা'),
      l('Epilepsy clinic', 'মৃগী ক্লিনিক'),
      l('EEG & NCS', 'ইইজি ও এনসিএস'),
      l('Headache & migraine', 'মাথাব্যথা ও মাইগ্রেন'),
    ],
  },
  {
    slug: 'ent',
    icon: 'ear',
    image: '/images/departments/ent.webp',
    name: l('ENT', 'নাক, কান ও গলা'),
    summary: l(
      'Ear, nose, throat, head and neck.',
      'নাক, কান, গলা, মাথা ও ঘাড়।',
    ),
    description: l(
      'ENT specialists treat hearing loss, sinusitis, tonsillitis and voice problems, and perform endoscopic sinus and ear surgery.',
      'নাক-কান-গলা বিশেষজ্ঞরা শ্রবণশক্তি হ্রাস, সাইনোসাইটিস, টনসিলাইটিস ও কণ্ঠস্বরের সমস্যার চিকিৎসা করেন এবং এন্ডোস্কোপিক সাইনাস ও কানের সার্জারি করেন।',
    ),
    services: [
      l('Audiometry', 'অডিওমেট্রি'),
      l('Endoscopic sinus surgery', 'এন্ডোস্কোপিক সাইনাস সার্জারি'),
      l('Tonsillectomy', 'টনসিল অপারেশন'),
      l('Voice clinic', 'ভয়েস ক্লিনিক'),
    ],
  },
];

export interface DoctorProfileSeed {
  readonly name_bn: string;
  readonly designation: Localized;
  readonly qualifications: string;
  readonly experience_years: number;
  readonly gender: 'male' | 'female';
  readonly bio: Localized;
}

const SPECIALTY_LABELS: Readonly<Record<string, Localized>> = {
  Cardiology: l('Cardiologist', 'হৃদরোগ বিশেষজ্ঞ'),
  Obstetrics: l('Gynaecologist & Obstetrician', 'স্ত্রীরোগ ও প্রসূতি বিশেষজ্ঞ'),
  Orthopaedics: l('Orthopaedic Surgeon', 'অর্থোপেডিক সার্জন'),
  Paediatrics: l('Paediatrician', 'শিশু বিশেষজ্ঞ'),
  'General Medicine': l('Medicine Specialist', 'মেডিসিন বিশেষজ্ঞ'),
  Dermatology: l('Dermatologist', 'চর্মরোগ বিশেষজ্ঞ'),
  Neurology: l('Neurologist', 'স্নায়ুরোগ বিশেষজ্ঞ'),
  ENT: l('ENT Specialist', 'নাক-কান-গলা বিশেষজ্ঞ'),
};

export function specialtyLabel(specialty: string): Localized {
  return SPECIALTY_LABELS[specialty] ?? l(specialty, specialty);
}

const senior = l('Senior Consultant', 'সিনিয়র কনসালট্যান্ট');
const consultant = l('Consultant', 'কনসালট্যান্ট');
const professor = l('Professor & Head of Department', 'অধ্যাপক ও বিভাগীয় প্রধান');

/** Keyed by the staff-side doctor id. */
export const DOCTOR_PROFILES: Readonly<Record<number, DoctorProfileSeed>> = {
  1: {
    name_bn: 'ডা. ইমরান হোসেন',
    designation: professor,
    qualifications: 'MBBS, FCPS (Medicine), MD (Cardiology)',
    experience_years: 22,
    gender: 'male',
    bio: l(
      'Dr. Imran Hossain leads the cardiology department and has performed more than 3,000 coronary interventions. His clinical interests are acute coronary syndrome and heart failure.',
      'ডা. ইমরান হোসেন কার্ডিওলজি বিভাগের প্রধান এবং ৩,০০০-এর বেশি করোনারি ইন্টারভেনশন করেছেন। তাঁর বিশেষ আগ্রহ অ্যাকিউট করোনারি সিনড্রোম ও হার্ট ফেইলিউর।',
    ),
  },
  2: {
    name_bn: 'ডা. শাহানা পারভীন',
    designation: professor,
    qualifications: 'MBBS, FCPS (Obs & Gynae), MS',
    experience_years: 20,
    gender: 'female',
    bio: l(
      'Dr. Shahana Parvin specialises in high-risk pregnancy and laparoscopic gynaecological surgery.',
      'ডা. শাহানা পারভীন ঝুঁকিপূর্ণ গর্ভাবস্থা ও ল্যাপারোস্কোপিক গাইনি সার্জারিতে বিশেষজ্ঞ।',
    ),
  },
  3: {
    name_bn: 'ডা. মাহবুব আলম',
    designation: senior,
    qualifications: 'MBBS, MS (Orthopaedics), AO Fellow',
    experience_years: 16,
    gender: 'male',
    bio: l(
      'Dr. Mahbub Alam focuses on joint replacement and complex trauma surgery.',
      'ডা. মাহবুব আলম জয়েন্ট রিপ্লেসমেন্ট ও জটিল ট্রমা সার্জারিতে কাজ করেন।',
    ),
  },
  4: {
    name_bn: 'ডা. তাহমিনা রশিদ',
    designation: senior,
    qualifications: 'MBBS, DCH, FCPS (Paediatrics)',
    experience_years: 14,
    gender: 'female',
    bio: l(
      'Dr. Tahmina Rashid runs the growth and development clinic and has a special interest in neonatal care.',
      'ডা. তাহমিনা রশিদ বৃদ্ধি ও বিকাশ ক্লিনিক পরিচালনা করেন এবং নবজাতক সেবায় বিশেষ আগ্রহী।',
    ),
  },
  5: {
    name_bn: 'ডা. কাজী নুরুল',
    designation: consultant,
    qualifications: 'MBBS, FCPS (Medicine)',
    experience_years: 11,
    gender: 'male',
    bio: l(
      'Dr. Kazi Nurul manages diabetes, hypertension and infectious disease.',
      'ডা. কাজী নুরুল ডায়াবেটিস, উচ্চ রক্তচাপ ও সংক্রামক রোগের চিকিৎসা করেন।',
    ),
  },
  6: {
    name_bn: 'ডা. সাদিয়া ইসলাম',
    designation: consultant,
    qualifications: 'MBBS, DDV, FCPS (Dermatology)',
    experience_years: 9,
    gender: 'female',
    bio: l(
      'Dr. Sadia Islam treats chronic skin disease and leads the laser therapy service.',
      'ডা. সাদিয়া ইসলাম দীর্ঘমেয়াদি চর্মরোগের চিকিৎসা করেন এবং লেজার থেরাপি সেবা পরিচালনা করেন।',
    ),
  },
  7: {
    name_bn: 'ডা. রেজাউল করিম',
    designation: professor,
    qualifications: 'MBBS, FCPS (Medicine), MD (Neurology)',
    experience_years: 24,
    gender: 'male',
    bio: l(
      'Dr. Rezaul Karim set up the hospital’s rapid stroke pathway and treats epilepsy and movement disorders.',
      'ডা. রেজাউল করিম হাসপাতালের দ্রুত স্ট্রোক চিকিৎসা ব্যবস্থা চালু করেন এবং মৃগী ও মুভমেন্ট ডিসঅর্ডারের চিকিৎসা করেন।',
    ),
  },
  8: {
    name_bn: 'ডা. ফারজানা হক',
    designation: senior,
    qualifications: 'MBBS, DLO, MS (ENT)',
    experience_years: 13,
    gender: 'female',
    bio: l(
      'Dr. Farzana Haque performs endoscopic sinus surgery and runs the voice clinic.',
      'ডা. ফারজানা হক এন্ডোস্কোপিক সাইনাস সার্জারি করেন এবং ভয়েস ক্লিনিক পরিচালনা করেন।',
    ),
  },
  9: {
    name_bn: 'ডা. নাসরিন সুলতানা',
    designation: consultant,
    qualifications: 'MBBS, FCPS (Obs & Gynae)',
    experience_years: 10,
    gender: 'female',
    bio: l(
      'Dr. Nasrin Sultana provides antenatal care and infertility counselling.',
      'ডা. নাসরিন সুলতানা গর্ভকালীন সেবা ও বন্ধ্যাত্ব বিষয়ক পরামর্শ দেন।',
    ),
  },
  10: {
    name_bn: 'ডা. আশরাফুল হক',
    designation: senior,
    qualifications: 'MBBS, MD (Cardiology), FACC',
    experience_years: 15,
    gender: 'male',
    bio: l(
      'Dr. Ashraful Haque is an interventional cardiologist with an interest in heart-rhythm disorders.',
      'ডা. আশরাফুল হক একজন ইন্টারভেনশনাল কার্ডিওলজিস্ট, হৃদস্পন্দনজনিত সমস্যায় বিশেষ আগ্রহী।',
    ),
  },
  11: {
    name_bn: 'ডা. মিজানুর রহমান',
    designation: consultant,
    qualifications: 'MBBS, MD (Paediatrics)',
    experience_years: 8,
    gender: 'male',
    bio: l(
      'Dr. Mizanur Rahman treats childhood asthma, allergy and infections.',
      'ডা. মিজানুর রহমান শিশুদের হাঁপানি, অ্যালার্জি ও সংক্রমণের চিকিৎসা করেন।',
    ),
  },
  12: {
    name_bn: 'ডা. রুমানা আফরোজ',
    designation: consultant,
    qualifications: 'MBBS, CCD, FCPS (Medicine)',
    experience_years: 7,
    gender: 'female',
    bio: l(
      'Dr. Rumana Afroz runs the diabetes clinic and preventive health check-ups.',
      'ডা. রুমানা আফরোজ ডায়াবেটিস ক্লিনিক ও প্রতিরোধমূলক স্বাস্থ্য পরীক্ষা পরিচালনা করেন।',
    ),
  },
  13: {
    name_bn: 'ডা. শফিকুল ইসলাম',
    designation: consultant,
    qualifications: 'MBBS, D-Ortho, MS (Orthopaedics)',
    experience_years: 9,
    gender: 'male',
    bio: l(
      'Dr. Shafiqul Islam treats sports injuries and performs arthroscopic surgery.',
      'ডা. শফিকুল ইসলাম খেলাধুলাজনিত আঘাতের চিকিৎসা ও আর্থ্রোস্কোপিক সার্জারি করেন।',
    ),
  },
  14: {
    name_bn: 'ডা. লায়লা আরজুমান্দ',
    designation: senior,
    qualifications: 'MBBS, MD (Dermatology)',
    experience_years: 12,
    gender: 'female',
    bio: l(
      'Dr. Laila Arjumand specialises in psoriasis, vitiligo and paediatric dermatology.',
      'ডা. লায়লা আরজুমান্দ সোরিয়াসিস, শ্বেতী ও শিশুদের চর্মরোগে বিশেষজ্ঞ।',
    ),
  },
  15: {
    name_bn: 'ডা. জাহাঙ্গীর কবির',
    designation: senior,
    qualifications: 'MBBS, FCPS (Medicine), FRCP',
    experience_years: 17,
    gender: 'male',
    bio: l(
      'Dr. Jahangir Kabir treats headache, neuropathy and Parkinson’s disease.',
      'ডা. জাহাঙ্গীর কবির মাথাব্যথা, নিউরোপ্যাথি ও পারকিনসন রোগের চিকিৎসা করেন।',
    ),
  },
  16: {
    name_bn: 'ডা. মেহনাজ চৌধুরী',
    designation: consultant,
    qualifications: 'MBBS, FCPS (ENT)',
    experience_years: 6,
    gender: 'female',
    bio: l(
      'Dr. Mehnaz Chowdhury treats hearing loss and paediatric ENT conditions.',
      'ডা. মেহনাজ চৌধুরী শ্রবণশক্তি হ্রাস ও শিশুদের নাক-কান-গলার রোগের চিকিৎসা করেন।',
    ),
  },
};

export const LANGUAGES_SPOKEN = l('Bangla, English', 'বাংলা, ইংরেজি');

export const SERVICE_SEED: readonly HospitalServiceDto[] = [
  {
    slug: 'emergency',
    icon: 'siren',
    image: '/images/services/emergency.webp',
    category: 'clinical',
    is_emergency: true,
    name: l('24/7 Emergency', '২৪/৭ জরুরি বিভাগ'),
    summary: l(
      'Round-the-clock emergency and trauma care.',
      'সার্বক্ষণিক জরুরি ও ট্রমা চিকিৎসা।',
    ),
    description: l(
      'Our emergency department is open every hour of every day, staffed by emergency physicians and backed by on-call specialists, imaging and theatre.',
      'আমাদের জরুরি বিভাগ দিনরাত সবসময় খোলা থাকে। জরুরি চিকিৎসক, অন-কল বিশেষজ্ঞ, ইমেজিং ও অপারেশন থিয়েটার প্রস্তুত থাকে।',
    ),
    features: [
      l('Triage within 10 minutes', '১০ মিনিটের মধ্যে ট্রায়াজ'),
      l('Resuscitation bays', 'রিসাসিটেশন বে'),
      l('On-call specialists', 'অন-কল বিশেষজ্ঞ'),
    ],
  },
  {
    slug: 'icu',
    icon: 'bed',
    image: '/images/services/icu.webp',
    category: 'clinical',
    is_emergency: false,
    name: l('ICU, CCU & NICU', 'আইসিইউ, সিসিইউ ও এনআইসিইউ'),
    summary: l(
      'Intensive care for adults, cardiac patients and newborns.',
      'প্রাপ্তবয়স্ক, হৃদরোগী ও নবজাতকের নিবিড় পরিচর্যা।',
    ),
    description: l(
      'Forty intensive-care beds across adult ICU, CCU and NICU, each with ventilator support and one-to-one nursing.',
      'প্রাপ্তবয়স্ক আইসিইউ, সিসিইউ ও এনআইসিইউ মিলিয়ে ৪০টি নিবিড় পরিচর্যা শয্যা, প্রতিটিতে ভেন্টিলেটর সাপোর্ট ও একজন নার্স।',
    ),
    features: [
      l('Ventilator support', 'ভেন্টিলেটর সাপোর্ট'),
      l('Central monitoring', 'কেন্দ্রীয় মনিটরিং'),
      l('One-to-one nursing', 'প্রতি রোগীর জন্য একজন নার্স'),
    ],
  },
  {
    slug: 'diagnostics',
    icon: 'microscope',
    image: '/images/services/diagnostics.webp',
    category: 'diagnostic',
    is_emergency: false,
    name: l('Laboratory & Diagnostics', 'ল্যাবরেটরি ও ডায়াগনস্টিক'),
    summary: l(
      'Pathology, imaging and reports you can download online.',
      'প্যাথলজি, ইমেজিং এবং অনলাইনে রিপোর্ট ডাউনলোড।',
    ),
    description: l(
      'A fully automated laboratory and imaging suite with CT, MRI, digital X-ray and ultrasound. Reports are published to the patient portal as soon as they are verified.',
      'সম্পূর্ণ স্বয়ংক্রিয় ল্যাবরেটরি ও ইমেজিং সুবিধা: সিটি, এমআরআই, ডিজিটাল এক্স-রে ও আল্ট্রাসাউন্ড। রিপোর্ট যাচাই হওয়ামাত্র পেশেন্ট পোর্টালে প্রকাশ করা হয়।',
    ),
    features: [
      l('CT & 1.5T MRI', 'সিটি ও ১.৫টি এমআরআই'),
      l('Automated pathology', 'স্বয়ংক্রিয় প্যাথলজি'),
      l('Online reports', 'অনলাইন রিপোর্ট'),
    ],
  },
  {
    slug: 'surgery',
    icon: 'syringe',
    image: '/images/services/surgery.webp',
    category: 'clinical',
    is_emergency: false,
    name: l('Operation Theatres', 'অপারেশন থিয়েটার'),
    summary: l(
      'Modular theatres for general and specialist surgery.',
      'সাধারণ ও বিশেষায়িত সার্জারির জন্য মডুলার থিয়েটার।',
    ),
    description: l(
      'Six modular operation theatres with laminar airflow support general, laparoscopic, orthopaedic and cardiac surgery.',
      'ল্যামিনার এয়ারফ্লোসহ ছয়টি মডুলার অপারেশন থিয়েটারে সাধারণ, ল্যাপারোস্কোপিক, অর্থোপেডিক ও কার্ডিয়াক সার্জারি হয়।',
    ),
    features: [
      l('Laminar airflow', 'ল্যামিনার এয়ারফ্লো'),
      l('Laparoscopic suite', 'ল্যাপারোস্কোপিক স্যুট'),
      l('Post-op recovery', 'অপারেশন-পরবর্তী রিকভারি'),
    ],
  },
  {
    slug: 'dialysis',
    icon: 'droplet',
    image: '/images/services/dialysis.webp',
    category: 'clinical',
    is_emergency: false,
    name: l('Dialysis', 'ডায়ালাইসিস'),
    summary: l(
      'Haemodialysis in a calm, dedicated unit.',
      'নিরিবিলি পৃথক ইউনিটে হিমোডায়ালাইসিস।',
    ),
    description: l(
      'Twelve haemodialysis stations with nephrologist supervision, open six days a week.',
      'নেফ্রোলজিস্টের তত্ত্বাবধানে ১২টি হিমোডায়ালাইসিস স্টেশন, সপ্তাহে ছয় দিন খোলা।',
    ),
    features: [
      l('12 stations', '১২টি স্টেশন'),
      l('Nephrologist on duty', 'কর্তব্যরত নেফ্রোলজিস্ট'),
      l('Morning & evening shifts', 'সকাল ও সন্ধ্যা শিফট'),
    ],
  },
  {
    slug: 'pharmacy',
    icon: 'pill',
    image: '/images/services/pharmacy.webp',
    category: 'support',
    is_emergency: false,
    name: l('24-Hour Pharmacy', '২৪ ঘণ্টা ফার্মেসি'),
    summary: l(
      'Genuine medicines, open day and night.',
      'আসল ওষুধ, দিনরাত খোলা।',
    ),
    description: l(
      'Our in-house pharmacy stocks medicines sourced directly from licensed manufacturers and never closes.',
      'আমাদের নিজস্ব ফার্মেসিতে লাইসেন্সপ্রাপ্ত প্রস্তুতকারকের কাছ থেকে সরাসরি আনা ওষুধ পাওয়া যায় এবং এটি কখনো বন্ধ হয় না।',
    ),
    features: [
      l('Open 24 hours', '২৪ ঘণ্টা খোলা'),
      l('Cold-chain storage', 'কোল্ড-চেইন সংরক্ষণ'),
      l('Pharmacist counselling', 'ফার্মাসিস্টের পরামর্শ'),
    ],
  },
  {
    slug: 'ambulance',
    icon: 'ambulance',
    image: '/images/services/ambulance.webp',
    category: 'support',
    is_emergency: true,
    name: l('Ambulance Service', 'অ্যাম্বুলেন্স সেবা'),
    summary: l(
      'ICU and standard ambulances across the city.',
      'শহরজুড়ে আইসিইউ ও সাধারণ অ্যাম্বুলেন্স।',
    ),
    description: l(
      'Call the hotline for an ICU or standard ambulance. Each is crewed by a trained paramedic.',
      'আইসিইউ বা সাধারণ অ্যাম্বুলেন্সের জন্য হটলাইনে কল করুন। প্রতিটিতে প্রশিক্ষিত প্যারামেডিক থাকেন।',
    ),
    features: [
      l('ICU ambulance', 'আইসিইউ অ্যাম্বুলেন্স'),
      l('Trained paramedics', 'প্রশিক্ষিত প্যারামেডিক'),
      l('24/7 dispatch', '২৪/৭ প্রেরণ'),
    ],
  },
  {
    slug: 'health-checkup',
    icon: 'clipboard-check',
    image: '/images/services/health-checkup.webp',
    category: 'diagnostic',
    is_emergency: false,
    name: l('Health Check-up', 'স্বাস্থ্য পরীক্ষা'),
    summary: l(
      'Preventive packages for every age.',
      'সব বয়সের জন্য প্রতিরোধমূলক প্যাকেজ।',
    ),
    description: l(
      'Screening packages that bundle the right tests with a physician review, completed in a single morning.',
      'প্রয়োজনীয় পরীক্ষা ও চিকিৎসকের পর্যালোচনা একসঙ্গে, এক সকালেই সম্পন্ন।',
    ),
    features: [
      l('Same-day results', 'একই দিনে ফলাফল'),
      l('Physician review', 'চিকিৎসকের পর্যালোচনা'),
      l('Packages for all ages', 'সব বয়সের প্যাকেজ'),
    ],
  },
];

export const PACKAGE_SEED: readonly HealthPackageDto[] = [
  {
    id: 1,
    name: l('Basic Health Check', 'বেসিক হেলথ চেক'),
    price: '2500.00',
    is_popular: false,
    tests: [
      l('Complete blood count', 'কমপ্লিট ব্লাড কাউন্ট'),
      l('Fasting blood sugar', 'ফাস্টিং ব্লাড সুগার'),
      l('Urine R/E', 'ইউরিন আর/ই'),
      l('Chest X-ray', 'বুকের এক্স-রে'),
      l('Physician consultation', 'চিকিৎসকের পরামর্শ'),
    ],
  },
  {
    id: 2,
    name: l('Executive Health Check', 'এক্সিকিউটিভ হেলথ চেক'),
    price: '6500.00',
    is_popular: true,
    tests: [
      l('Everything in Basic', 'বেসিকের সবকিছু'),
      l('Lipid profile & HbA1c', 'লিপিড প্রোফাইল ও এইচবিএ১সি'),
      l('Liver & kidney function', 'লিভার ও কিডনি ফাংশন'),
      l('ECG & echocardiogram', 'ইসিজি ও ইকোকার্ডিওগ্রাম'),
      l('Ultrasound of whole abdomen', 'সম্পূর্ণ পেটের আল্ট্রাসাউন্ড'),
    ],
  },
  {
    id: 3,
    name: l('Senior Citizen Check', 'প্রবীণ স্বাস্থ্য পরীক্ষা'),
    price: '8500.00',
    is_popular: false,
    tests: [
      l('Everything in Executive', 'এক্সিকিউটিভের সবকিছু'),
      l('Thyroid profile', 'থাইরয়েড প্রোফাইল'),
      l('Bone density (DEXA)', 'হাড়ের ঘনত্ব (ডেক্সা)'),
      l('Eye & ENT screening', 'চোখ ও নাক-কান-গলা স্ক্রিনিং'),
      l('Cardiologist review', 'হৃদরোগ বিশেষজ্ঞের পর্যালোচনা'),
    ],
  },
];

export const TESTIMONIAL_SEED: readonly TestimonialDto[] = [
  {
    id: 1,
    name: l('Nazmul Hasan', 'নাজমুল হাসান'),
    location: l('Mirpur, Dhaka', 'মিরপুর, ঢাকা'),
    quote: l(
      'My father was taken to the CCU at 2 AM and the team had him stable within the hour. The nurses explained everything to us.',
      'রাত ২টায় বাবাকে সিসিইউতে নেওয়া হয় এবং এক ঘণ্টার মধ্যে টিম তাঁকে স্থিতিশীল করে। নার্সরা আমাদের সবকিছু বুঝিয়ে বলেছেন।',
    ),
  },
  {
    id: 2,
    name: l('Sharmin Akter', 'শারমিন আক্তার'),
    location: l('Uttara, Dhaka', 'উত্তরা, ঢাকা'),
    quote: l(
      'Booking online took two minutes and I was seen at my slot time. Downloading my reports from home saved another trip.',
      'অনলাইনে বুকিং করতে দুই মিনিট লেগেছে এবং নির্ধারিত সময়েই ডাক্তার দেখিয়েছি। বাসা থেকে রিপোর্ট ডাউনলোড করতে পারায় আরেকবার আসতে হয়নি।',
    ),
  },
  {
    id: 3,
    name: l('Abdul Mannan', 'আব্দুল মান্নান'),
    location: l('Narayanganj', 'নারায়ণগঞ্জ'),
    quote: l(
      'After my knee replacement the physiotherapy team had me walking in two days. Clean wards and caring staff.',
      'হাঁটু প্রতিস্থাপনের পর ফিজিওথেরাপি টিম দুই দিনের মধ্যেই আমাকে হাঁটিয়েছে। পরিচ্ছন্ন ওয়ার্ড ও আন্তরিক কর্মী।',
    ),
  },
];
