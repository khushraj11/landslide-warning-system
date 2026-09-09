"""
Offline dictionary-based translations for alert messages.
No external API dependency -- works fully offline (PS requirement).

Languages covered (9 total — all 8 NER states):
  English, Hindi, Assamese, Bengali, Mizo (Mizoram),
  Manipuri (Manipur), Nepali (Sikkim), Bodo (Assam), Khasi (Meghalaya)
"""

ALERT_TEMPLATES = {
    "English": {
        "Severe": "SEVERE ALERT: {district} is at SEVERE landslide risk. Evacuate low-lying and slope-adjacent areas immediately. Avoid travel on affected roads.",
        "High": "HIGH ALERT: {district} shows HIGH landslide risk. Stay alert, avoid unnecessary travel near slopes, monitor official updates.",
        "Moderate": "ADVISORY: {district} shows MODERATE risk. Continue normal activity but stay informed of weather updates.",
        "Low": "{district} is currently at LOW risk. No action needed.",
    },
    "Hindi": {
        "Severe": "gambhir chetawni: {district} mein bhooskhalan ka atyadhik khatara hai. Turant dhaalan aur niche ilakon se surakshit sthan par jayen. Prabhavit sadakon par yatra na karen.",
        "High": "uchch chetawni: {district} mein bhooskhalan ka uchch khatara hai. Satark rahen, dhaalan wale kshetron ki anaavashyak yatra se bachen.",
        "Moderate": "soochna: {district} mein madhyam khatara hai. Saamaany gatividhi jaari rakhen, mausam ki jaankaari lete rahen.",
        "Low": "{district} mein filhaal kam khatara hai. Koi karravaee aavashyak nahi.",
    },
    "Assamese": {
        "Severe": "Gurutor Satarkabaani: {district}t pahar dhangsar atyadhik aashanka aase. Tatkhyanat bipodjonok anchalar pora aantori jaok.",
        "High": "Uchch Satarkabaani: {district}t pahar dhangsar uchch aashanka aase. Satark thaakak.",
        "Moderate": "Jaanoni: {district}t madhyam aashanka aase. Batorar baatri chaai thaakak.",
        "Low": "{district}t bortaman kam aashanka aase.",
    },
    "Bengali": {
        "Severe": "Gurutor Satarkata: {district}-e bhumidhoser atyanta jhuki royeche. Abilambe dhalu ebong nichu elaaka theke sore jan.",
        "High": "Uchcha Satarkata: {district}-e bhumidhoser uchcha jhuki royeche. Satark thakun, aprayojoniya bhramon eriye chalun.",
        "Moderate": "Paramarsha: {district}-e majhari jhuki royeche. Swabhabik karjokram chaliye jan, abohaoyar update dekhun.",
        "Low": "{district}-e bortomane jhuki kom.",
    },
    "Mizo": {
        "Severe": "CHHE TLAK ZAWNG: {district}-ah lei tlang liam tlang CHHE TLAK zawng a awm. Dah lam leh thla tuar lam atangin chhuah chhuak ang che u. Kawng hlauhawm ah haw suh.",
        "High": "HLAUHAWM ZAWNG: {district}-ah lei tlang liam zawng a awm. Ngaihawm rawh, thla tlang kawng ah haw suh.",
        "Moderate": "SAWISEL: {district}-ah hlauhawm chungchang a awm. Thinlungril lo la, tlanglawi pawimawh zawng en rawh.",
        "Low": "{district}-ah hlauhawm tak tak a awm lo. Hnatlang a ngai lo.",
    },
    "Manipuri": {
        "Severe": "Khudinggi Warning: {district}da meiynggi seng sitpagi khudinggi yaiba louthoklei. Senggi macha tungda leibasigna maru chakei.",
        "High": "Hai Warning: {district}da loutoklei yaiba meiyngggi seng sitpagi thamba lei. Aaob thoripa.",
        "Moderate": "Advisory: {district}da anaoba loutoklei lei. Paangthoklipa ngaangthoklipasigna saamnna sijiinnagiree.",
        "Low": "{district}da taada loutoklei yaiba awaanba leingi.",
    },
    "Nepali": {
        "Severe": "Gambhir Satarkata: {district}ma bhuskhalaanako atyanta jokhim chha. Turantai dhiskoo ra nichalo ilaakabaata suraksit thaauma januhosaa.",
        "High": "Uchcha Satarkata: {district}ma bhuskhalaanako uchcha jokhim chha. Satark rahnuhosaa, dhiskoonajikaiako yatrabaata bachnuhosaa.",
        "Moderate": "Suchana: {district}ma madhyam jokhim chha. Saamaanya gatividhi jaaree raakhnuhosaa tara mausam update herirahanuhosaa.",
        "Low": "{district}ma haala kam jokhim chha. Kunai kaaryavaahi aavashyak chhaina.",
    },
    "Bodo": {
        "Severe": "Daikhugi Forman: {district}aav mosou bokhonaay gonaanthar. Bimaani thanjayo, naijafor thaawni laakhibaano.",
        "High": "Bimaani Forman: {district}aav mosou bokhonaayyaav bimaan laano. Saavraaynaangou, thaav samo rokhom mondo.",
        "Moderate": "Forman: {district}aav bimaan laano. Raajkhaanthikhou solaaydonkhi khaalamno.",
        "Low": "{district}aav daa bimaan laayaakhi. Ebaa khaalaam aavashyak monnaiyo.",
    },
    "Khasi": {
        "Severe": "Jingkyrkhu Khraw: Ka {district} da lah jia ba ka khlieh rynsan da jingklop jingsangsang. Dei ban phai sha ka jaka balang bad sa biang bad nang.",
        "High": "Jingkyrkhu Sang: Ka {district} da leh ba pat ka jingklop jingsangsang. Dei ban ioh jingkyrkhu, kynmaw ban leit sha ka jaka khlieh.",
        "Moderate": "Jingpynbna: Ka {district} da leh ba ka jingklop pyrshang. Phah la ban sawbei phi da ka jingpyrshang.",
        "Low": "Ka {district} kynmaw da kynthup ka pat ba khraw. Ngan dei ban pynbna aiu aiu.",
    },
}

def get_alert(district, risk_label, language="English"):
    lang_dict = ALERT_TEMPLATES.get(language, ALERT_TEMPLATES["English"])
    template = lang_dict.get(risk_label, lang_dict["Low"])
    return template.format(district=district)
