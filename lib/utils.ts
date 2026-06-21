/**
 * Returns the exact Tailwind CSS class names (background and text color) 
 * for subject badges based on the subject name.
 */
export function getSubjectColor(subject: string): string {
  const sub = subject ? subject.toLowerCase() : '';
  
  if (sub.includes('math')) {
    return 'bg-[#1D4ED8] text-white border-transparent';
  }
  if (sub.includes('science')) {
    return 'bg-[#059669] text-white border-transparent';
  }
  if (sub.includes('social') || sub.includes('history') || sub.includes('civics') || sub.includes('geography')) {
    return 'bg-[#D97706] text-white border-transparent';
  }
  if (sub.includes('english') || sub.includes('lang')) {
    return 'bg-[#7C3AED] text-white border-transparent';
  }
  return 'bg-[#475569] text-white border-transparent';
}
