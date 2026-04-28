import asyncio
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.call import Call, CallStatus, ExtractionStatus
from app.utils.encryption import encrypt_for_storage


PROVIDERS = [
    "Dr. Raul Lopez",
    "Ilyana Yee, NP",
    "Monica Ogaz, NP",
    "Lucia Fisher, NP",
    "Amanda Lopez, PA",
    "Other",
    "Not Provided",
]

PRIMARY_INTENTS = [
    "Appointment (New/Reschedule/Cancel)",
    "Prescription Refill",
    "Procedure Inquiry",
    "Pre-Procedure Question",
    "Post-Procedure Concern",
    "Test Results",
    "Referral Request",
    "Medical Records",
    "Billing/Insurance Question",
    "Prior Authorization",
    "Workers Comp / LOP",
    "Telehealth",
    "Speak to Staff",
    "Report Symptoms",
    "Spam/Wrong Number",
    "Other",
    "Not Provided",
]

CALLER_AFFILIATIONS = [
    "Patient",
    "Family Member",
    "Caregiver",
    "Pharmacy",
    "Other Provider",
    "Hospital",
    "Insurance",
    "Workers Comp / Attorney",
    "Other",
    "Not Provided",
]

PRIORITIES = ["Low", "Medium", "High", "Not Provided"]

FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
    "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa",
    "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
    "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
    "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
    "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
    "Benjamin", "Samantha", "Samuel", "Katherine", "Frank", "Christine", "Gregory", "Debra",
    "Raymond", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Virginia",
    "Dennis", "Maria", "Jerry", "Heather", "Tyler", "Diane", "Aaron", "Julie",
    "Jose", "Joyce", "Henry", "Victoria", "Adam", "Kelly", "Douglas", "Christina",
    "Nathan", "Joan", "Zachary", "Evelyn", "Kyle", "Judith", "Noah", "Megan",
    "Ethan", "Cheryl", "Jeremy", "Andrea", "Walter", "Hannah", "Christian", "Jacqueline",
    "Keith", "Martha", "Roger", "Gloria", "Terry", "Teresa", "Gerald", "Sara",
    "Harold", "Janice", "Sean", "Marie", "Austin", "Julia", "Carl", "Grace",
    "Arthur", "Judy", "Lawrence", "Theresa", "Dylan", "Madison", "Jesse", "Beverly",
    "Jordan", "Denise", "Bryan", "Marilyn", "Billy", "Amber", "Joe", "Danielle",
    "Bruce", "Rose", "Gabriel", "Brittany", "Logan", "Diana", "Albert", "Abigail",
    "Alan", "Jane", "Juan", "Lori", "Wayne", "Olivia", "Roy", "Jean",
    "Ralph", "Frances", "Eugene", "Kathryn", "Louis", "Alice", "Philip", "Jasmine",
    "Johnny", "Gail", "Bobby", "Joan", "Noah", "Evelyn", "Randy", "Judith",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor",
    "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Sanchez",
    "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
    "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams",
    "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
    "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards",
    "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers",
    "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey", "Reed", "Kelly",
    "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson", "Brooks",
    "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
    "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross",
    "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell", "Sullivan", "Bell",
    "Coleman", "Butler", "Henderson", "Barnes", "Gonzales", "Fisher", "Vasquez", "Simmons",
    "Romero", "Jordan", "Patterson", "Alexander", "Hamilton", "Graham", "Reynolds", "Griffin",
    "Wallace", "Moreno", "West", "Cole", "Hayes", "Bryant", "Herrera", "Gibson",
    "Ellis", "Tran", "Medina", "Aguilar", "Stevens", "Murray", "Ford", "Castro",
    "Marshall", "Owens", "Harrison", "Fernandez", "Mcdonald", "Woods", "Washington", "Kennedy",
    "Wells", "Vargas", "Henry", "Chen", "Freeman", "Webb", "Tucker", "Guzman",
    "Burns", "Crawford", "Olson", "Simpson", "Porter", "Hunter", "Gordon", "Mendez",
    "Silva", "Shaw", "Snyder", "Mason", "Dixon", "Munoz", "Hunt", "Hicks",
    "Holmes", "Palmer", "Wagner", "Black", "Robertson", "Boyd", "Rose", "Stone",
    "Salazar", "Fox", "Warren", "Mills", "Meyer", "Rice", "Schmidt", "Garza",
    "Daniels", "Ferguson", "Nichols", "Stephens", "Soto", "Weaver", "Ryan", "Gardner",
    "Payne", "Grant", "Dunn", "Kelley", "Spencer", "Hawkins", "Arnold", "Pierce",
    "Vazquez", "Hansen", "Peters", "Santos", "Hart", "Bradley", "Knight", "Elliott",
    "Cunningham", "Duncan", "Armstrong", "Hudson", "Carroll", "Lane", "Riley", "Andrews",
    "Alvarado", "Ray", "Delgado", "Berry", "Perkins", "Hoffman", "Johnston", "Matthews",
    "Pena", "Richards", "Contreras", "Willis", "Carpenter", "Lawrence", "Sandoval", "Guerrero",
    "George", "Chapman", "Rios", "Estrada", "Ortega", "Watkins", "Greene", "Nunez",
    "Wheeler", "Valdez", "Harper", "Lynch", "Barker", "Maldonado", "Oneal", "Summers",
    "Buchanan", "Morton", "Savage", "Dennis", "Mcgee", "Farmer", "Delacruz", "Aguirre",
    "Vega", "Glover", "Manning", "Cohen", "Harmon", "Rodgers", "Robbins", "Newton",
    "Todd", "Blair", "Higgins", "Ingram", "Reese", "Cannon", "Strickland", "Townsend",
    "Potter", "Goodwin", "Walton", "Rowe", "Hampton", "Ortega", "Patton", "Swanson",
    "Joseph", "Combs", "Petty", "Cochran", "Brewer", "Bauer", "Franklin", "Love",
    "Yates", "Beasley", "Klein", "Pratt", "Casey", "Branch", "Flowers", "Valenzuela",
    "Parks", "Mcconnell", "Watts", "Barker", "Norris", "Vaughan", "Vazquez", "Rocha",
    "Booker", "Mercado", "Cordova", "Waller", "Arellano", "Madden", "Mata", "Bonilla",
    "Stanton", "Compton", "Kaufman", "Dudley", "Mcpherson", "Beltran", "Dickson", "Mccann",
    "Villegas", "Proctor", "Hester", "Cantrell", "Daugherty", "Cherry", "Bray", "Davila",
    "Rowland", "Levine", "Madden", "Spence", "Good", "Irwin", "Werner", "Krause",
    "Petty", "Whitney", "Baird", "Hooper", "Pollard", "Zavala", "Jarvis", "Holden",
    "Haas", "Hendrix", "Mcgrath", "Bird", "Lucero", "Terrell", "Riggs", "Joyce",
    "Mercer", "Rollins", "Galloway", "Duke", "Odom", "Andersen", "Downs", "Hatfield",
    "Benitez", "Archer", "Huerta", "Travis", "Mcneil", "Hinton", "Zhang", "Hays",
    "Mayo", "Fritz", "Branch", "Mooney", "Ewing", "Ritter", "Esparza", "Frey",
    "Braun", "Gay", "Riddle", "Haney", "Kaiser", "Holder", "Chaney", "Mcknight",
    "Gamble", "Vang", "Cooley", "Carney", "Cowan", "Forbes", "Ferrell", "Davies",
    "Barajas", "Shea", "Osborn", "Bright", "Cuevas", "Bolton", "Murillo", "Lutz",
    "Duarte", "Kidd", "Key", "Cooke", "Goff", "Dejesus", "Marin", "Dotson",
    "Bonner", "Cotton", "Wise", "Gill", "Mclaughlin", "Harmon", "Hood", "Mccullough",
    "Richards", "Henson", "Cisneros", "Hale", "Hancock", "Grimes", "Glenn", "Cline",
    "Delacruz", "Camacho", "Dillon", "Parrish", "Oneill", "Melton", "Booth", "Kane",
    "Berg", "Harrell", "Pitts", "Savage", "Wiggins", "Brennan", "Salas", "Marks",
    "Russo", "Sawyer", "Baxter", "Golden", "Hutchinson", "Liu", "Walter", "Mcdowell",
    "Wiley", "Rich", "Humphrey", "Johns", "Koch", "Suarez", "Hobbs", "Beard",
    "Gilmore", "Pitts", "Mccarthy", "Durham", "Pollard", "Melendez", "Booth", "Little",
    "Fowler", "Calderon", "Santiago", "Small", "Herman", "Kramer", "Swanson", "Fuentes",
    "Bond", "Bernard", "Villarreal", "Kaufman", "Roy", "Mack", "Dickson", "Mccormick",
    "Wall", "Quinn", "Ashley", "Padilla", "Rocha", "Cabrera", "Guzman", "Warren",
    "Acevedo", "Gay", "Osborne", "Acosta", "Warner", "Pacheco", "Glass", "Abrams",
    "Odell", "Baird", "Becerra", "Saunders", "Blankenship", "Langley", "Goldstein", "Velazquez",
    "Stark", "Bowers", "Lowery", "Schmitt", "Hoover", "Perry", "Nicholson", "Underwood",
    "Tate", "Salinas", "Berg", "Shaffer", "Carroll", "Valdez", "Horn", "Sheppard",
    "Burns", "Hoover", "Gallegos", "Peterson", "Santana", "Guzman", "Morrison", "Kline",
    "Bush", "Gill", "Case", "Schroeder", "Newton", "Bartlett", "Valentine", "Mccall",
    "Tanner", "Levine", "Norris", "Mclaughlin", "Juarez", "Banks", "Orr", "Marsh",
    "Mccarty", "Cline", "Key", "Higgins", "Carrillo", "Mays", "Clay", "Daugherty",
    "Roach", "Cochran", "Pritchard", "Pate", "May", "Trevino", "Goss", "Swenson",
    "Oconnor", "Bass", "Jefferson", "Townsend", "Horton", "Pratt", "Casey", "Shepard",
    "Cardenas", "Dennis", "Sampson", "Tanner", "Atkinson", "Medina", "Lam", "Hahn",
    "Garrison", "Ewing", "Osborne", "Mercer", "Brock", "Lassiter", "Bond", "Dyer",
    "Solis", "Davies", "Solomon", "Vang", "Fontenot", "Forrest", "Frye", "Kiser",
    "Farley", "Nixon", "Mccann", "Hyde", "Pennington", "Bernstein", "Gorman", "Buck",
    "Pitts", "Crosby", "Burnett", "Lynch", "Santiago", "Carr", "Roach", "Rollins",
    "Kendrick", "Gentry", "Holloway", "Adkins", "Ortega", "Galloway", "Galvan", "Galloway",
    "Galvan", "Galloway", "Galvan", "Galloway", "Galvan", "Galloway", "Galvan", "Galloway",
]

PHONE_AREA_CODES = ["915", "915", "915", "915", "915", "915", "915", "575", "432", "806"]

_GREETING = "AI: Hello, you've reached West Texas Pain Institute. How can I help you?"

TRANSCRIPT_TEMPLATES = {
    "Appointment (New/Reschedule/Cancel)": [
        f"{_GREETING}\nUser: Hi, I need to schedule a follow-up with {{provider}}.\nAI: Of course — let me get some details so the team can get that set up for you. Can I get your name?\nUser: {{caller_name}}.\nAI: Got it. And what's your date of birth?\nUser: {{patient_dob}}.\nAI: Okay. Do you have a preferred location — East on Gateway, Northeast, or West on Desert Pass?\nUser: East works best.\nAI: Alright, I've got everything noted. Someone from the team will reach out to confirm. Is the number you're calling from the best one to reach you?\nUser: Yes, that's fine.\nAI: Sounds good. We'll be in touch. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: I need to reschedule my appointment with {{provider}}.\nAI: Of course. Can I get your name?\nUser: {{caller_name}}.\nAI: And your date of birth?\nUser: {{patient_dob}}.\nAI: Got it. I'll note that you need to reschedule. Someone from the team will reach out to get that set up for you. Is the number you're calling from the best one to reach you?\nUser: Yes.\nAI: Alright, we'll be in touch. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: Hi, I'd like to cancel my appointment on {{date}} with {{provider}}.\nAI: No problem. Can I get your name and date of birth?\nUser: {{caller_name}}, {{patient_dob}}.\nAI: Got it — I'll let the team know. Anything else?\nUser: No, that's it.\nAI: Sounds good. Thank you, {{caller_name}}.",
    ],
    "Prescription Refill": [
        f"{_GREETING}\nUser: Hi, I need a refill on my pain medication.\nAI: Of course — which medication is it?\nUser: My gabapentin.\nAI: Got it. Which pharmacy do you use?\nUser: Walgreens on Mesa.\nAI: And which provider here writes that prescription?\nUser: {{provider}}.\nAI: Okay. Can I get your name?\nUser: {{caller_name}}.\nAI: And your date of birth?\nUser: {{patient_dob}}.\nAI: Alright, I've got everything noted. The team will look into it and follow up with you. Is the number you're calling from the best one to reach you?\nUser: Yes.\nAI: Sounds good. We'll be in touch. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: I'm calling about a refill — my muscle relaxer ran out.\nAI: Got it. Which medication and which pharmacy?\nUser: Tizanidine, sent to CVS on Montana.\nAI: Okay. And who's your provider here?\nUser: {{provider}}.\nAI: Can I get your name and date of birth?\nUser: {{caller_name}}, {{patient_dob}}.\nAI: Alright, I'll get this to the team and they'll follow up. Thank you, {{caller_name}}.",
    ],
    "Procedure Inquiry": [
        f"{_GREETING}\nUser: Hi, I'm calling to ask about radiofrequency ablation. My pain doctor mentioned it.\nAI: Yeah — that's something Dr. Lopez does here. He's double board-certified in pain medicine and anesthesiology. Can I get your name?\nUser: {{caller_name}}.\nAI: And your date of birth?\nUser: {{patient_dob}}.\nAI: Have you been seen here before?\nUser: No, I'd be a new patient.\nAI: Got it — welcome. The team will reach back out to get you set up for a consultation. Is this the best number to reach you?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: I wanted to ask about a spinal cord stimulator — is that something you all do?\nAI: Yeah, Dr. Lopez does both SCS trials and permanent implants here. Can I get your name?\nUser: {{caller_name}}.\nAI: And your date of birth?\nUser: {{patient_dob}}.\nAI: I'll get this to the team and they'll reach back out to talk through next steps. Is this the best number for you?\nUser: Yes.\nAI: Perfect. Thank you, {{caller_name}}.",
    ],
    "Pre-Procedure Question": [
        f"{_GREETING}\nUser: I have my injection scheduled for next week — I take blood thinners and wasn't sure when to stop.\nAI: That's a great question for the team — they'll go over all of that with you. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: And which provider is doing the procedure?\nUser: {{provider}}.\nAI: Got it. The team will call you back with the answer. Is this the best number?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: I have an RFA scheduled and I just wanted to check if I need someone to drive me home.\nAI: I'll make sure the team gets your question and gets back to you. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Got it. They'll call you back. Thank you, {{caller_name}}.",
    ],
    "Post-Procedure Concern": [
        f"{_GREETING}\nUser: I had an epidural injection a couple days ago and the area is really sore and warm.\nAI: Oh, I'm really sorry to hear that. Let me get all the details so the right person can follow up. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Which provider performed the injection?\nUser: {{provider}}.\nAI: How long ago was the procedure?\nUser: Two days.\nAI: Okay — I'm gonna flag this right away so the team can reach out to you as soon as possible. Is this the best number?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: I had my SCS trial yesterday and the leads feel like they shifted.\nAI: Okay — let me get the details and make sure the team gets to you quickly. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Which provider did the trial?\nUser: {{provider}}.\nAI: Got it — flagging this now. Is this the best number?\nUser: Yes.\nAI: Thank you, {{caller_name}}.",
    ],
    "Test Results": [
        f"{_GREETING}\nUser: I'm calling to check on my MRI results.\nAI: Of course. Can I get your name?\nUser: {{caller_name}}.\nAI: And your date of birth?\nUser: {{patient_dob}}.\nAI: Which provider ordered the MRI?\nUser: {{provider}}.\nAI: Got it. I'll note that and the team will reach back out. Is this the best number?\nUser: Yes.\nAI: Alright, we'll be in touch. Thank you, {{caller_name}}.",
    ],
    "Report Symptoms": [
        f"{_GREETING}\nUser: My back pain has been getting worse over the past few days.\nAI: Oh, I'm sorry to hear that. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Which provider do you see here?\nUser: {{provider}}.\nAI: Can you tell me a little more about what's going on?\nUser: It's lower back, started about three days ago, getting harder to walk.\nAI: Okay — I've got that all noted. The team will reach out as soon as possible. Is this the best number?\nUser: Yes.\nAI: Thank you, {{caller_name}}.",
    ],
    "Billing/Insurance Question": [
        f"{_GREETING}\nUser: I have a question about a bill I got.\nAI: Of course — let me grab your details so the right person can look into that. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Got it. I'll make sure the billing team gets this. Is the number you're calling from the best one?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
        f"{_GREETING}\nUser: I'm calling to see if you take Blue Cross.\nAI: Yeah, we accept Blue Cross. Coverage can vary by plan though, so the team can verify your specific policy. Want me to take down your info?\nUser: Yes please.\nAI: Can I get your name and the plan name?\nUser: {{caller_name}}, Blue Cross PPO.\nAI: Got it. They'll follow up. Thank you, {{caller_name}}.",
    ],
    "Medical Records": [
        f"{_GREETING}\nUser: I need a copy of my records sent to a new doctor here in El Paso.\nAI: Of course. Can I get your name and date of birth?\nUser: {{caller_name}}, DOB {{patient_dob}}.\nAI: And where would you like the records sent?\nUser: To my primary care doctor's office over on Mesa.\nAI: Got it. I'll note that for the team. Is the number you're calling from the best one to reach you?\nUser: Yes.\nAI: Alright, we'll be in touch. Thank you, {{caller_name}}.",
    ],
    "Referral Request": [
        f"{_GREETING}\nUser: My PCP referred me to you all for chronic back pain.\nAI: Welcome — happy to get you scheduled. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Do you know which doctor referred you?\nUser: Dr. Sandoval at Sun City Family Medicine.\nAI: Got it. The team will reach out to get you set up for a consultation. Is this the best number?\nUser: Yes.\nAI: Thank you, {{caller_name}}.",
    ],
    "Prior Authorization": [
        f"{_GREETING}\nUser: I'm calling to check on the prior auth for my radiofrequency ablation.\nAI: Of course. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Which provider is doing the procedure?\nUser: {{provider}}.\nAI: Got it. I'll note the question and the team will follow up. Is this the best number?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
    ],
    "Workers Comp / LOP": [
        f"{_GREETING}\nUser: Hi, I'm calling from Lopez Law Firm — we have a client on a Letter of Protection who needs to be seen.\nAI: Got it — yeah, we accept LOP cases. Can I get your name and direct number?\nUser: This is Sarah Reyes, 915-555-0142.\nAI: And the patient's name and date of birth?\nUser: {{caller_name}}, {{patient_dob}}.\nAI: Do you have a case number?\nUser: Yes, case number 2025-44781.\nAI: Got it — I'll get this to the team and they'll follow up. Thank you.",
        f"{_GREETING}\nUser: I had a work injury and my adjuster told me to come here.\nAI: Got it — we do see workers' comp patients. Can I get your name?\nUser: {{caller_name}}.\nAI: And date of birth?\nUser: {{patient_dob}}.\nAI: Do you have a claim number?\nUser: Yes, it's WC-2025-0381.\nAI: Perfect. I'll note all of that. The team will reach out to get you set up. Is this the best number?\nUser: Yes.\nAI: Thank you, {{caller_name}}.",
    ],
    "Telehealth": [
        f"{_GREETING}\nUser: Can I do my next visit by telehealth?\nAI: Yeah, we do telehealth for established patients. Can I get your name and date of birth?\nUser: {{caller_name}}, {{patient_dob}}.\nAI: And which provider do you see?\nUser: {{provider}}.\nAI: Got it. The team will reach out to set that up. Is this the best number?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
    ],
    "Speak to Staff": [
        f"{_GREETING}\nUser: I need to speak with someone about my appointment.\nAI: I can take down your info and make sure someone from the team reaches out. Can I get your name?\nUser: {{caller_name}}.\nAI: And which provider do you see here?\nUser: {{provider}}.\nAI: What's the question about your appointment?\nUser: I just want to confirm the time and location.\nAI: I'll note that. Someone will call you back to confirm. Is the number you're calling from the best one?\nUser: Yes.\nAI: Sounds good. Thank you, {{caller_name}}.",
    ],
    "Spam/Wrong Number": [
        f"{_GREETING}\nUser: Oh, sorry, I think I have the wrong number.\nAI: No problem at all. Have a good day!",
    ],
    "Other": [
        f"{_GREETING}\nUser: Quick question — what are your hours?\nAI: We're open Monday through Friday, 8 to 5.\nUser: Thank you.\nAI: You're welcome. Anything else I can help with?\nUser: No, that's all. Thanks!",
        f"{_GREETING}\nUser: Where is your East office located?\nAI: Our East office is at 7878 Gateway Boulevard East, Suite 402.\nUser: Got it, thank you.\nAI: You're welcome. Have a good day!",
    ],
}

SUMMARY_TEMPLATES = {
    "Appointment (New/Reschedule/Cancel)": [
        "{caller_name} called to schedule a follow-up with {provider} at the East office. Team will follow up to confirm.",
        "{caller_name} called to reschedule appointment with {provider}. Team will follow up with new date.",
        "{caller_name} called to cancel appointment with {provider} on {date}.",
    ],
    "Prescription Refill": [
        "{caller_name} called to request a gabapentin refill through {provider}. Sent to Walgreens on Mesa. Team will follow up.",
        "{caller_name} called to request a tizanidine refill through {provider}. Sent to CVS on Montana. Team will follow up.",
        "{caller_name} called to request a pain medication refill through {provider}. Team will follow up.",
    ],
    "Procedure Inquiry": [
        "{caller_name} (new patient) called asking about radiofrequency ablation. Team will follow up to schedule a consultation.",
        "{caller_name} called asking about spinal cord stimulator options with {provider}. Team will follow up.",
        "{caller_name} called asking about epidural steroid injection options. Team will follow up.",
    ],
    "Pre-Procedure Question": [
        "{caller_name} called with a pre-procedure question about blood thinners before an upcoming injection with {provider}. Team will follow up.",
        "{caller_name} called asking about needing a ride home after RFA with {provider}. Team will follow up.",
        "{caller_name} called with a pre-procedure question for {provider}. Team will follow up.",
    ],
    "Post-Procedure Concern": [
        "{caller_name} called reporting soreness and warmth at injection site, two days post-epidural with {provider}. Flagged urgent.",
        "{caller_name} called reporting that SCS trial leads feel like they shifted, one day post-procedure with {provider}. Flagged urgent.",
        "{caller_name} called with a post-procedure concern after a recent visit with {provider}. Team will follow up urgently.",
    ],
    "Test Results": [
        "{caller_name} called asking about MRI results ordered by {provider}. Team will follow up.",
        "{caller_name} called asking about EMG/nerve study results from {provider}.",
        "{caller_name} called requesting test results from {provider}.",
    ],
    "Report Symptoms": [
        "{caller_name} called reporting worsening lower back pain over the past few days. Sees {provider}. Team will follow up.",
        "{caller_name} called reporting a chronic pain flare. Sees {provider}. Team will follow up.",
        "{caller_name} called reporting new neuropathy symptoms. Sees {provider}. Team will follow up.",
    ],
    "Billing/Insurance Question": [
        "{caller_name} called with a billing question. Billing team will follow up.",
        "{caller_name} called to verify Blue Cross PPO coverage. Team will verify and follow up.",
        "{caller_name} called about a recent statement. Billing team will follow up.",
    ],
    "Medical Records": [
        "{caller_name} called requesting records be sent to a primary care doctor on Mesa in El Paso. Team will follow up.",
        "{caller_name} called requesting records from {provider}.",
        "{caller_name} called requesting medical records.",
    ],
    "Referral Request": [
        "{caller_name} called as a new patient referred by their PCP for chronic back pain. Team will follow up to schedule.",
        "{caller_name} called about a referral. Team will follow up.",
        "{caller_name} called about referral status. Sees {provider}.",
    ],
    "Prior Authorization": [
        "{caller_name} called checking on prior auth status for radiofrequency ablation with {provider}. Team will follow up.",
        "{caller_name} called requesting prior authorization for procedure with {provider}.",
        "{caller_name} called about prior auth status with {provider}.",
    ],
    "Workers Comp / LOP": [
        "Sarah Reyes from Lopez Law Firm called about a Letter of Protection for {caller_name}, case 2025-44781. Team will follow up.",
        "{caller_name} called about a workers' comp claim (WC-2025-0381). Team will follow up to schedule.",
        "{caller_name} called about a workers' comp / LOP intake. Team will follow up.",
    ],
    "Telehealth": [
        "{caller_name} called asking about a telehealth visit with {provider}. Team will follow up to schedule.",
        "{caller_name} called requesting telehealth setup with {provider}.",
        "{caller_name} called with a telehealth question. Team will follow up.",
    ],
    "Speak to Staff": [
        "{caller_name} called wanting to confirm appointment time with {provider}. Team will call back.",
        "{caller_name} called with a question for {provider}'s team.",
        "{caller_name} called needing to speak with staff about {provider}.",
    ],
    "Spam/Wrong Number": [
        "Wrong number — caller dialed incorrectly.",
        "Spam call — no patient interaction.",
        "Wrong number.",
    ],
    "Other": [
        "{caller_name} called asking about office hours. Answered directly.",
        "{caller_name} called with a general question about the practice.",
        "{caller_name} called asking for the address.",
    ],
}


def generate_phone_number() -> str:
    area_code = random.choice(PHONE_AREA_CODES)
    exchange = random.randint(200, 999)
    number = random.randint(1000, 9999)
    return f"+1{area_code}{exchange}{number}"


def generate_dob() -> str:
    year = random.randint(1940, 2005)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{month:02d}/{day:02d}/{year}"


def generate_name() -> tuple[str, str]:
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    return first, last


def generate_transcript(intent: str, caller_name: str, patient_dob: str, provider: str) -> str:
    templates = TRANSCRIPT_TEMPLATES.get(intent, TRANSCRIPT_TEMPLATES["Other"])
    template = random.choice(templates)
    date = (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%B %d")
    return template.format(
        caller_name=caller_name,
        patient_dob=patient_dob,
        provider=provider,
        date=date,
    )


def generate_summary(intent: str, caller_name: str, provider: str) -> str:
    templates = SUMMARY_TEMPLATES.get(intent, SUMMARY_TEMPLATES["Other"])
    template = random.choice(templates)
    date = (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%m/%d")
    return template.format(caller_name=caller_name, provider=provider, date=date)


async def seed_fake_calls(db, num_calls: int = 100) -> None:
    print(f"Generating {num_calls} fake calls...")

    for i in range(num_calls):
        first_name, last_name = generate_name()
        caller_name = f"{first_name} {last_name}"
        patient_name = caller_name if random.random() > 0.3 else f"{random.choice(FIRST_NAMES)} {last_name}"
        patient_dob = generate_dob()
        phone_number = generate_phone_number()
        provider = random.choice(PROVIDERS)
        intent = random.choice(PRIMARY_INTENTS)
        affiliation = random.choice(CALLER_AFFILIATIONS)
        priority = random.choice(PRIORITIES)
        is_reviewed = random.random() > 0.6
        status = CallStatus.COMPLETED

        created_at = datetime.now(timezone.utc) - timedelta(
            days=random.randint(0, 30),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
        )
        duration_seconds = random.randint(30, 600)

        transcript = generate_transcript(intent, caller_name, patient_dob, provider)
        summary = generate_summary(intent, caller_name, provider)

        vapi_data = {
            "type": "end-of-call-report",
            "call": {
                "id": f"vapi_call_{i}_{random.randint(1000, 9999)}",
                "customer": {
                    "number": phone_number,
                },
                "durationSeconds": duration_seconds,
            },
            "analysis": {
                "structuredData": {
                    "caller_name": caller_name,
                    "caller_affiliation": affiliation,
                    "patient_name": patient_name,
                    "patient_dob": patient_dob,
                    "provider_name": provider,
                    "primary_intent": intent,
                    "priority": priority,
                },
            },
            "artifact": {
                "transcript": transcript,
                "recordingUrl": f"https://storage.vapi.ai/recordings/fake_call_{i}.mp3",
            },
            "durationSeconds": duration_seconds,
        }

        extraction_data = {
            "caller_name": caller_name,
            "caller_affiliation": affiliation,
            "patient_name": patient_name,
            "patient_dob": patient_dob,
            "provider_name": provider,
            "primary_intent": intent,
            "priority": priority,
            "summary": summary,
        }

        encrypted_vapi_data, vapi_kid = encrypt_for_storage(json.dumps(vapi_data))
        encrypted_extraction_data, extraction_kid = encrypt_for_storage(json.dumps(extraction_data))

        call = Call(
            twilio_call_sid=f"CA{random.randint(1000000000000000000, 9999999999999999999)}",
            vapi_call_id=vapi_data["call"]["id"],
            vapi_data_encrypted=encrypted_vapi_data,
            vapi_data_kid=vapi_kid,
            extraction_data_encrypted=encrypted_extraction_data,
            extraction_data_kid=extraction_kid,
            extraction_status=ExtractionStatus.COMPLETED,
            status=status,
            is_reviewed=is_reviewed,
            created_at=created_at,
            updated_at=created_at + timedelta(seconds=duration_seconds),
        )

        db.add(call)

        if (i + 1) % 10 == 0:
            await db.commit()
            print(f"Created {i + 1} calls...")

    await db.commit()
    print(f"Successfully created {num_calls} fake calls!")


async def main() -> None:
    print("Seeding fake call data...")
    print("-" * 40)

    async with AsyncSessionLocal() as db:
        await seed_fake_calls(db, num_calls=100)

    print("-" * 40)
    print("Seeding complete!")


if __name__ == "__main__":
    asyncio.run(main())
