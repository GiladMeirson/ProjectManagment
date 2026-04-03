const STATUS = Object.freeze({
  WAITING: "ממתין",
  IN_PROGRESS: "בעבודה",
  PLANS_SENT_FOR_REVIEW: "נשלחו תוכניות לעיון",
  UPDATED_PLANS_SENT: "נשלחו תוכניות מעודכנות",
  PLANS_SENT_FOR_TENDER: "נשלחו תוכניות למכרז",
  PLANS_SENT_FOR_EXECUTION: "נשלחו תוכניות לביצוע",
  SPECIAL: "מיוחד",
});

const PRIORITY = Object.freeze({
  ON_HOLD: "--",
  URGENT: "דחוף",
  NEW: "חדש",
});

const YES_NO = Object.freeze({
  YES: "כן",
  NO: "לא",
});

const PRICE_OFFER_STATUS = Object.freeze({
  WAITING:         "ממתין",
  SENT:            "נשלח",
  RECEIVED_SIGNED: "התקבל חתום",
});

const PRICE_OFFER_STATUS_BADGE_MAP = Object.freeze({
  "ממתין":        "badge-status-waiting",
  "נשלח":         "badge-status-working",
  "התקבל חתום":   "badge-yes",
});
