"""
Simple offline dictionary-based translations for alert messages.
No external API dependency -- works fully offline, which matches the
PS requirement for low-network/offline functionality in remote NER areas.
"""

ALERT_TEMPLATES = {
    "English": {
        "Severe": "SEVERE ALERT: {district} is at SEVERE landslide risk. Evacuate low-lying and slope-adjacent areas immediately. Avoid travel on affected roads.",
        "High": "HIGH ALERT: {district} shows HIGH landslide risk. Stay alert, avoid unnecessary travel near slopes, monitor official updates.",
        "Moderate": "ADVISORY: {district} shows MODERATE risk. Continue normal activity but stay informed of weather updates.",
        "Low": "{district} is currently at LOW risk. No action needed.",
    },
    "Hindi": {
        "Severe": "गंभीर चेतावनी: {district} में भूस्खलन का अत्यधिक खतरा है। तुरंत ढलान ऴर निचले इलाकों से सुरक्षित स्थान पर जाएं। प्रभावित सड़कों पर यात्रा न करें।",
        "High": "उच्च चेतावनी: {district} में भूस्खलन का उच्च खतरा है। सतर्क रहें, ढलान वाले क्षेत्रों की अनावश्यक यात्रा से बचें।",
        "Moderate": "सूचना: {district} में मध्यम खतरा है। सामान्य गतिविधि जारी रखें, मौसम की जानकारी लेते रहें।",
        "Low": "{district} में फिलहाल कम खतरा है। कोई कार्रवाई आवश्यक नहीं।",
    },
    "Assamese": {
        "Severe": "গুৰুতৰ সতৰ্কবাণী: {district}ত পাহাৰ ধ্বংসৰ অত্যধিক আশংকা আছে। তৎক্ষণাৎ বিপদজনক অঞ্চলৰ পৰা আঁতৰি যাওক।",
        "High": "উচ্চ সতৰ্কবাণী: {district}ত পাহাৰ ধ্বংসৰ উচ্চ আশংকা আছে। সতৰ্ক থাকক।",
        "Moderate": "জাননী: {district}ত মধ্যম আশংকা আছে। বতৰৰ বাতৰি চাই থাকক।",
        "Low": "{district}ত বৰ্তমান কম আশংকা আছে।",
    },
    "Bengali": {
        "Severe": "গুরুতর সতর্কতা: {district}-এ ভূমিধসের অত্যন্ত ঝুঁকি রয়েছে। অবিলম্বে ঢালু এবং নিচু এলাকা থেকে সরে যান।",
        "High": "উচ্চ সতর্কতা: {district}-এ ভূমিধসের উচ্চ ঝুঁকি রয়েছে। সতর্ক থাকুন, অপ্রয়োজনীয় ভ্রমণ এড়িয়ে চলুন।",
        "Moderate": "পরামর্শ: {district}-এ মাঝারি ঝুঁকি রয়েছে। স্বাভাবিক কার্যক্রম চালিয়ে যান, আবহাওয়ার আপডেট দেখুন।",
        "Low": "{district}-এ বর্তমানে ঝুঁকি কম।",
    },
}

def get_alert(district, risk_label, language="English"):
    lang_dict = ALERT_TEMPLATES.get(language, ALERT_TEMPLATES["English"])
    template = lang_dict.get(risk_label, lang_dict["Low"])
    return template.format(district=district)
