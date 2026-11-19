// The campaign desk's simulated run: one campaign, twelve made-up leads, and
// the call each one gets. The transcripts were written ahead of time; nothing
// is dialled. Outcome names are the ones the ElevenLabs calling API returns
// (answered, voicemail, busy, no_answer, failed), so real calls can share the board.

export const CAMPAIGN = {
  client: "Khidmati Service Centre",
  name: "CPR card renewal reminders",
  goal: "Remind each person of their appointment and confirm they will attend.",
  rules: ["Calls 9:00 to 18:00", "Two attempts at most", "Says it is an AI", "Offers a person on request", "Honours the DNC list"],
};

const AI = "agent";
const C = "customer";
const t = (who, text, en) => ({ who, text, en });

export const LEADS = [
  {
    name: "Hassan Al Aali", gender: "male", phone: "+973 3••• ••41", language: "ar", appointment: "Mon 23 Nov, 09:30", outcome: "answered", result: "Confirmed", secs: 41,
    summary: "Reminder for an CPR card renewal on Monday at half past nine. He confirmed he will attend.",
    transcript: [
      t(AI, "السلام عليكم، وياك المساعد الآلي من مركز خدمتي. أكلم الأخ حسن العالي؟", "Peace be upon you, this is the AI assistant from Khidmati Service Centre. Am I speaking with Hassan Al Aali?"),
      t(C, "وعليكم السلام، إي أنا حسن.", "And upon you peace. Yes, this is Hassan."),
      t(AI, "حبيت أذكرك بموعد تجديد البطاقة يوم الاثنين الساعة تسع ونص الصبح في مركز مدينة عيسى. بتحضر إن شاء الله؟", "I wanted to remind you of your CPR card renewal appointment on Monday at half past nine in the morning at the Isa Town centre. Will you attend?"),
      t(C, "إي إن شاء الله بحضر.", "Yes, God willing, I will."),
      t(AI, "زين، أكدت لك الموعد: الاثنين تسع ونص. تبي شي ثاني؟", "Good, I have confirmed your appointment: Monday, half past nine. Anything else?"),
      t(C, "لا مشكور.", "No, thank you."),
      t(AI, "حياك الله، مع السلامة.", "You are welcome. Goodbye."),
    ],
  },
  {
    name: "Maryam Al Sayed", gender: "female", phone: "+973 3••• ••16", language: "ar", appointment: "Sun 22 Nov, 10:00", outcome: "answered", result: "Handed to a person", secs: 52, handover: "government", flags: ["asked_for_person"],
    summary: "She cannot attend on Sunday at ten because of a hospital appointment and wants another morning next week, at Isa Town if possible. She asked to speak to a person.",
    transcript: [
      t(AI, "السلام عليكم، وياج المساعد الآلي من مركز خدمتي. أكلم الأخت مريم السيد؟", "Peace be upon you, this is the AI assistant from Khidmati Service Centre. Am I speaking with Maryam Al Sayed?"),
      t(C, "وعليكم السلام، إي نعم.", "And upon you peace. Yes."),
      t(AI, "حبيت أذكرج بموعد تجديد البطاقة يوم الأحد الساعة عشر الصبح. بتحضرين؟", "I wanted to remind you of your CPR card renewal appointment on Sunday at ten in the morning. Will you attend?"),
      t(C, "والله ما أقدر، بنتي عندها موعد في المستشفى نفس الوقت. أبي أغير الموعد، وأبي أكلم موظف لو سمحت.", "Honestly I cannot, my daughter has a hospital appointment at the same time. I want to change it, and I would like to speak to a member of staff please."),
      t(AI, "أكيد، ما عليه. بحولج الحين على موظف وبعطيه ملخص عشان ما تعيدين الكلام. لحظة من فضلج.", "Of course, no problem. I will transfer you to a member of staff now and give them a summary so you do not have to repeat yourself. One moment please."),
      t(C, "مشكورة.", "Thank you."),
    ],
  },
  {
    name: "Zainab Al Asfoor", gender: "female", phone: "+973 3••• ••07", language: "ar", appointment: "Mon 23 Nov, 11:00", outcome: "voicemail", result: "Message left", secs: 19,
    summary: "Voicemail. A short reminder was left with the appointment day and time.",
    transcript: [t(AI, "السلام عليكم، هذي رسالة من المساعد الآلي في مركز خدمتي: نذكرج بموعد تجديد البطاقة يوم الاثنين الساعة إحدعش الصبح في مركز مدينة عيسى. مع السلامة.", "Peace be upon you. This is a message from the AI assistant at Khidmati Service Centre: a reminder of your CPR card renewal appointment on Monday at eleven in the morning at the Isa Town centre. Goodbye.")],
  },
  {
    name: "Ebrahim Salman", gender: "male", phone: "+973 3••• ••88", language: "en", appointment: "Tue 24 Nov, 08:30", outcome: "answered", result: "Confirmed", secs: 44,
    summary: "Reminder for an CPR card renewal on Tuesday at half past eight. He confirmed and asked what to bring; the assistant listed the documents.",
    transcript: [
      t(AI, "السلام عليكم, this is the AI assistant from Khidmati Service Centre. Am I speaking with Ebrahim Salman?"),
      t(C, "Yes, speaking."),
      t(AI, "I'm calling to remind you of your CPR card renewal appointment on Tuesday at half past eight in the morning, at the Isa Town centre. Will you be able to attend?"),
      t(C, "Yes, I'll be there. What do I need to bring?"),
      t(AI, "Your current CPR card and proof of address dated within the last three months. The renewal fee is paid at the centre by card."),
      t(C, "Great, thanks."),
      t(AI, "You're welcome. إن شاء الله we will see you on Tuesday at half past eight. Is there anything else I can help with?"),
      t(C, "No, that's all."),
      t(AI, "Thank you. مع السلامة."),
    ],
  },
  {
    name: "Khalid Al Mannai", gender: "male", phone: "+973 3••• ••52", language: "ar", appointment: "Tue 24 Nov, 13:00", outcome: "no_answer", result: "Retry later", secs: 0,
    summary: "No answer. One more attempt is scheduled inside calling hours.", transcript: [],
  },
  {
    name: "Sara Yousif", gender: "female", phone: "+973 3••• ••30", language: "en", appointment: "Wed 25 Nov, 09:15", outcome: "answered", result: "Opted out", secs: 27, flags: ["do_not_call"],
    summary: "She asked not to be called again. Her number was marked do not call and no further attempts will be made.",
    transcript: [
      t(AI, "السلام عليكم, this is the AI assistant from Khidmati Service Centre. Am I speaking with Sara Yousif?"),
      t(C, "Yes, but please don't call me again. Send me a text instead."),
      t(AI, "Understood. I've marked your number as do not call, so you won't get any more calls from us. Sorry to have disturbed you. Goodbye."),
    ],
  },
  {
    name: "Noora Janahi", gender: "female", phone: "+973 3••• ••65", language: "ar", appointment: "Mon 23 Nov, 12:30", outcome: "answered", result: "Confirmed", secs: 38,
    summary: "Reminder for an CPR card renewal on Monday at half past twelve. She confirmed she will attend.",
    transcript: [
      t(AI, "السلام عليكم، وياج المساعد الآلي من مركز خدمتي. أكلم الأخت نورة جناحي؟", "Peace be upon you, this is the AI assistant from Khidmati Service Centre. Am I speaking with Noora Janahi?"),
      t(C, "إي، تفضل.", "Yes, go ahead."),
      t(AI, "أذكرج بموعد تجديد البطاقة يوم الاثنين الساعة ثنتعش ونص الظهر في مركز المحرق. يناسبج الموعد؟", "A reminder of your CPR card renewal appointment on Monday at half past twelve at the Muharraq centre. Does the time suit you?"),
      t(C, "إي يناسبني، بكون موجودة.", "Yes it suits me, I will be there."),
      t(AI, "تمام، الموعد مؤكد: الاثنين ثنتعش ونص في مركز المحرق. تبين شي ثاني؟", "Great, the appointment is confirmed: Monday, half past twelve at the Muharraq centre. Do you need anything else?"),
      t(C, "لا، مشكورة.", "No, thank you."),
      t(AI, "حياج الله، مع السلامة.", "You are welcome. Goodbye."),
    ],
  },
  {
    name: "Jassim Al Tamimi", gender: "male", phone: "+973 3••• ••93", language: "ar", appointment: "Wed 25 Nov, 10:45", outcome: "busy", result: "Retry later", secs: 0,
    summary: "The line was busy. One more attempt is scheduled inside calling hours.", transcript: [],
  },
  {
    name: "Huda Kamal", gender: "female", phone: "+973 3••• ••24", language: "ar", appointment: "Tue 24 Nov, 10:00", outcome: "answered", result: "Callback requested", secs: 47, flags: ["promised_callback"],
    summary: "She is travelling on Tuesday and cannot attend. She was driving and asked for a call back after four to choose a new time. A callback was booked for a member of staff.",
    transcript: [
      t(AI, "السلام عليكم، وياج المساعد الآلي من مركز خدمتي. أكلم الأخت هدى كمال؟", "Peace be upon you, this is the AI assistant from Khidmati Service Centre. Am I speaking with Huda Kamal?"),
      t(C, "إي أنا هدى، بس أنا أسوق الحين.", "Yes, this is Huda, but I am driving right now."),
      t(AI, "ما بطول عليج. عندج موعد تجديد البطاقة يوم الثلاثاء الساعة عشر. بتحضرين؟", "I will not keep you. You have an CPR card renewal appointment on Tuesday at ten. Will you attend?"),
      t(C, "لا، بكون مسافرة. اتصلوا فيني بعد الساعة أربع عشان أختار موعد ثاني.", "No, I will be travelling. Call me after four so I can choose another time."),
      t(AI, "زين، سجلت طلبج: موظف بيتصل فيج اليوم بعد الساعة أربع. سوقي بحذر، مع السلامة.", "Good, I have noted your request: a member of staff will call you today after four. Drive safely, goodbye."),
    ],
  },
  {
    name: "Ali Jaffar", gender: "male", phone: "+973 3••• ••70", language: "ar", appointment: "Wed 25 Nov, 12:00", outcome: "failed", result: "Number not in service", secs: 0,
    summary: "The call could not be connected. The number is not in service and needs checking.", transcript: [],
  },
  {
    name: "Mohammed Al Doseri", gender: "male", phone: "+973 3••• ••19", language: "en", appointment: "Mon 23 Nov, 14:15", outcome: "answered", result: "Wrong person", secs: 24,
    summary: "The person who answered was not Mohammed Al Doseri. The assistant shared no appointment details and ended the call.",
    transcript: [
      t(AI, "السلام عليكم, this is the AI assistant from Khidmati Service Centre. Am I speaking with Mohammed Al Doseri?"),
      t(C, "No, this is his brother. What is it about?"),
      t(AI, "Thank you. I can only discuss this with Mohammed himself. I'll try him again another time. Sorry to disturb you, goodbye."),
    ],
  },
  {
    name: "Fatima Bucheeri", gender: "female", phone: "+973 3••• ••58", language: "ar", appointment: "Tue 24 Nov, 11:30", outcome: "answered", result: "Confirmed", secs: 36,
    summary: "Reminder for an CPR card renewal on Tuesday at half past eleven. She confirmed she will attend.",
    transcript: [
      t(AI, "السلام عليكم، وياج المساعد الآلي من مركز خدمتي. أكلم الأخت فاطمة بوجيري؟", "Peace be upon you, this is the AI assistant from Khidmati Service Centre. Am I speaking with Fatima Bucheeri?"),
      t(C, "وعليكم السلام، إي أنا.", "And upon you peace. Yes, that is me."),
      t(AI, "أذكرج بموعد تجديد البطاقة يوم الثلاثاء الساعة إحدعش ونص الصبح في مركز مدينة عيسى. بتحضرين؟", "A reminder of your CPR card renewal appointment on Tuesday at half past eleven in the morning at the Isa Town centre. Will you attend?"),
      t(C, "إي أكيد.", "Yes, definitely."),
      t(AI, "تمام، أكدت لج الموعد. مع السلامة.", "Great, I have confirmed your appointment. Goodbye."),
    ],
  },
];
