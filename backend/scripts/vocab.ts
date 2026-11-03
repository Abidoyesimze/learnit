export type Word = [target: string, english: string];
export type Sentence = { target: string[]; english: string; extra: string[] };
export type LessonData = { title: string; theme: string; words: Word[]; sentences: Sentence[] };

export const FR: LessonData[] = [
  { title: "Greetings", theme: "greetings", words: [["bonjour","hello"],["bonsoir","good evening"],["salut","hi"],["merci","thank you"],["s'il vous plaît","please"],["au revoir","goodbye"],["oui","yes"],["non","no"]],
    sentences: [
      { target: ["Bonjour","je","m'appelle","Amara"], english: "Hello, my name is Amara", extra: ["tu","suis"] },
      { target: ["Comment","allez-vous"], english: "How are you", extra: ["où","merci"] },
      { target: ["Merci","beaucoup"], english: "Thank you very much", extra: ["bonjour","peu"] } ] },
  { title: "Numbers", theme: "numbers", words: [["un","one"],["deux","two"],["trois","three"],["quatre","four"],["cinq","five"],["six","six"],["dix","ten"],["vingt","twenty"]],
    sentences: [
      { target: ["J'ai","deux","frères"], english: "I have two brothers", extra: ["trois","sœurs"] },
      { target: ["Il","est","trois","heures"], english: "It is three o'clock", extra: ["quatre","jours"] },
      { target: ["J'ai","dix","ans"], english: "I am ten years old", extra: ["vingt","mois"] } ] },
  { title: "Market and money", theme: "market and money", words: [["le marché","the market"],["combien","how much"],["cher","expensive"],["pas cher","cheap"],["l'argent","money"],["acheter","to buy"],["payer","to pay"],["le prix","the price"]],
    sentences: [
      { target: ["Combien","ça","coûte"], english: "How much does it cost", extra: ["cher","achète"] },
      { target: ["C'est","trop","cher"], english: "It is too expensive", extra: ["peu","bon"] },
      { target: ["Je","voudrais","payer"], english: "I would like to pay", extra: ["acheter","tu"] } ] },
  { title: "Directions", theme: "directions", words: [["à gauche","on the left"],["à droite","on the right"],["tout droit","straight ahead"],["la rue","the street"],["près","near"],["loin","far"],["où","where"],["la gare","the station"]],
    sentences: [
      { target: ["Où","est","la","gare"], english: "Where is the station", extra: ["rue","loin"] },
      { target: ["Tournez","à","gauche"], english: "Turn left", extra: ["droite","tout"] },
      { target: ["C'est","loin","d'ici"], english: "It is far from here", extra: ["près","où"] } ] },
  { title: "Food", theme: "food", words: [["le pain","bread"],["l'eau","water"],["le riz","rice"],["le poulet","chicken"],["le poisson","fish"],["la banane","banana"],["le café","coffee"],["j'ai faim","I am hungry"]],
    sentences: [
      { target: ["Je","voudrais","de","l'eau"], english: "I would like some water", extra: ["pain","tu"] },
      { target: ["Le","poisson","est","bon"], english: "The fish is good", extra: ["riz","mauvais"] },
      { target: ["J'aime","le","riz"], english: "I like rice", extra: ["poulet","la"] } ] },
];

export const ES: LessonData[] = [
  { title: "Greetings", theme: "greetings", words: [["hola","hello"],["buenos días","good morning"],["buenas tardes","good afternoon"],["adiós","goodbye"],["gracias","thank you"],["por favor","please"],["sí","yes"],["mucho gusto","nice to meet you"]],
    sentences: [
      { target: ["Hola","me","llamo","Diego"], english: "Hello, my name is Diego", extra: ["eres","soy"] },
      { target: ["Cómo","está","usted"], english: "How are you", extra: ["dónde","gracias"] },
      { target: ["Muchas","gracias"], english: "Thank you very much", extra: ["hola","poco"] } ] },
  { title: "Numbers", theme: "numbers", words: [["uno","one"],["dos","two"],["tres","three"],["cuatro","four"],["cinco","five"],["seis","six"],["diez","ten"],["veinte","twenty"]],
    sentences: [
      { target: ["Tengo","dos","hermanos"], english: "I have two brothers", extra: ["tres","hermanas"] },
      { target: ["Son","las","tres"], english: "It is three o'clock", extra: ["cuatro","días"] },
      { target: ["Tengo","diez","años"], english: "I am ten years old", extra: ["veinte","meses"] } ] },
  { title: "Market and money", theme: "market and money", words: [["el mercado","the market"],["cuánto","how much"],["caro","expensive"],["barato","cheap"],["el dinero","money"],["comprar","to buy"],["pagar","to pay"],["el precio","the price"]],
    sentences: [
      { target: ["Cuánto","cuesta"], english: "How much does it cost", extra: ["caro","compro"] },
      { target: ["Es","muy","caro"], english: "It is very expensive", extra: ["poco","bueno"] },
      { target: ["Quiero","pagar"], english: "I want to pay", extra: ["comprar","tú"] } ] },
  { title: "Directions", theme: "directions", words: [["a la izquierda","on the left"],["a la derecha","on the right"],["derecho","straight ahead"],["la calle","the street"],["cerca","near"],["lejos","far"],["dónde","where"],["la estación","the station"]],
    sentences: [
      { target: ["Dónde","está","la","estación"], english: "Where is the station", extra: ["calle","lejos"] },
      { target: ["Gire","a","la","izquierda"], english: "Turn left", extra: ["derecha","todo"] },
      { target: ["Está","lejos","de","aquí"], english: "It is far from here", extra: ["cerca","dónde"] } ] },
  { title: "Food", theme: "food", words: [["el pan","bread"],["el agua","water"],["el arroz","rice"],["el pollo","chicken"],["el pescado","fish"],["la banana","banana"],["el café","coffee"],["tengo hambre","I am hungry"]],
    sentences: [
      { target: ["Quiero","agua"], english: "I want water", extra: ["pan","tú"] },
      { target: ["El","pescado","está","rico"], english: "The fish is tasty", extra: ["arroz","malo"] },
      { target: ["Me","gusta","el","arroz"], english: "I like rice", extra: ["pollo","la"] } ] },
];

export const FR_UNIT2: LessonData[] = [
  { title: "Family", theme: "family", words: [["la famille","family"],["la mère","mother"],["le père","father"],["le frère","brother"],["la sœur","sister"],["le fils","son"],["la fille","daughter"],["l'enfant","child"]],
    sentences: [
      { target: ["C'est","ma","famille"], english: "This is my family", extra: ["père","mère"] },
      { target: ["Mon","frère","est","grand"], english: "My brother is tall", extra: ["petit","sœur"] },
      { target: ["J'ai","deux","sœurs"], english: "I have two sisters", extra: ["trois","frères"] } ] },
  { title: "Time and daily routine", theme: "time and daily routine", words: [["aujourd'hui","today"],["demain","tomorrow"],["hier","yesterday"],["le matin","morning"],["la nuit","night"],["se réveiller","to wake up"],["dormir","to sleep"],["toujours","always"]],
    sentences: [
      { target: ["Je","me","réveille","tôt"], english: "I wake up early", extra: ["dormir","tard"] },
      { target: ["À","demain"], english: "See you tomorrow", extra: ["hier","toujours"] },
      { target: ["Je","dors","la","nuit"], english: "I sleep at night", extra: ["matin","toujours"] } ] },
  { title: "Travel and transport", theme: "travel and transport", words: [["l'aéroport","the airport"],["le billet","the ticket"],["le train","the train"],["le bus","the bus"],["la voiture","the car"],["voyager","to travel"],["la valise","the suitcase"],["le passeport","the passport"]],
    sentences: [
      { target: ["Je","voudrais","un","billet"], english: "I would like a ticket", extra: ["passeport","valise"] },
      { target: ["Où","est","l'aéroport"], english: "Where is the airport", extra: ["gare","loin"] },
      { target: ["Je","voyage","en","train"], english: "I am traveling by train", extra: ["bus","voiture"] } ] },
  { title: "Weather", theme: "weather", words: [["le temps","the weather"],["le soleil","sun"],["la pluie","rain"],["chaud","hot"],["froid","cold"],["le vent","wind"],["le nuage","cloud"],["la tempête","the storm"]],
    sentences: [
      { target: ["Il","fait","chaud","aujourd'hui"], english: "It is hot today", extra: ["froid","demain"] },
      { target: ["Il","pleut"], english: "It is raining", extra: ["neige","vent"] },
      { target: ["J'aime","le","soleil"], english: "I like the sun", extra: ["pluie","nuage"] } ] },
  { title: "Restaurant", theme: "restaurant", words: [["le restaurant","the restaurant"],["le menu","the menu"],["l'addition","the bill"],["commander","to order"],["délicieux","delicious"],["le serveur","the waiter"],["la table","the table"],["le dessert","the dessert"]],
    sentences: [
      { target: ["L'addition","s'il","vous","plaît"], english: "The bill please", extra: ["menu","merci"] },
      { target: ["Je","voudrais","commander"], english: "I would like to order", extra: ["payer","acheter"] },
      { target: ["C'est","délicieux"], english: "This is delicious", extra: ["bon","mauvais"] } ] },
];

export const ES_UNIT2: LessonData[] = [
  { title: "Family", theme: "family", words: [["la familia","family"],["la madre","mother"],["el padre","father"],["el hermano","brother"],["la hermana","sister"],["el hijo","son"],["la hija","daughter"],["el niño","child"]],
    sentences: [
      { target: ["Esta","es","mi","familia"], english: "This is my family", extra: ["padre","madre"] },
      { target: ["Mi","hermano","es","alto"], english: "My brother is tall", extra: ["bajo","hermana"] },
      { target: ["Tengo","dos","hermanas"], english: "I have two sisters", extra: ["tres","hermanos"] } ] },
  { title: "Time and daily routine", theme: "time and daily routine", words: [["hoy","today"],["mañana","tomorrow"],["ayer","yesterday"],["la mañana","morning"],["la noche","night"],["despertarse","to wake up"],["dormir","to sleep"],["siempre","always"]],
    sentences: [
      { target: ["Me","despierto","temprano"], english: "I wake up early", extra: ["dormir","tarde"] },
      { target: ["Hasta","mañana"], english: "See you tomorrow", extra: ["ayer","siempre"] },
      { target: ["Duermo","por","la","noche"], english: "I sleep at night", extra: ["mañana","siempre"] } ] },
  { title: "Travel and transport", theme: "travel and transport", words: [["el aeropuerto","the airport"],["el boleto","the ticket"],["el tren","the train"],["el autobús","the bus"],["el carro","the car"],["viajar","to travel"],["la maleta","the suitcase"],["el pasaporte","the passport"]],
    sentences: [
      { target: ["Quiero","un","boleto"], english: "I would like a ticket", extra: ["pasaporte","maleta"] },
      { target: ["Dónde","está","el","aeropuerto"], english: "Where is the airport", extra: ["estación","lejos"] },
      { target: ["Viajo","en","tren"], english: "I am traveling by train", extra: ["autobús","carro"] } ] },
  { title: "Weather", theme: "weather", words: [["el clima","the weather"],["el sol","sun"],["la lluvia","rain"],["caluroso","hot"],["frío","cold"],["el viento","wind"],["la nube","cloud"],["la tormenta","the storm"]],
    sentences: [
      { target: ["Hace","calor","hoy"], english: "It is hot today", extra: ["frío","mañana"] },
      { target: ["Está","lloviendo"], english: "It is raining", extra: ["nieve","viento"] },
      { target: ["Me","gusta","el","sol"], english: "I like the sun", extra: ["lluvia","nube"] } ] },
  { title: "Restaurant", theme: "restaurant", words: [["el restaurante","the restaurant"],["el menú","the menu"],["la cuenta","the bill"],["pedir","to order"],["delicioso","delicious"],["el mesero","the waiter"],["la mesa","the table"],["el postre","the dessert"]],
    sentences: [
      { target: ["La","cuenta","por","favor"], english: "The bill please", extra: ["menú","gracias"] },
      { target: ["Quiero","pedir"], english: "I would like to order", extra: ["pagar","comprar"] },
      { target: ["Esto","está","delicioso"], english: "This is delicious", extra: ["bueno","malo"] } ] },
];

export const FR_UNIT3: LessonData[] = [
  { title: "Work and jobs", theme: "work and jobs", words: [["le travail","the job"],["le bureau","the office"],["le patron","the boss"],["le collègue","the colleague"],["la réunion","the meeting"],["travailler","to work"],["le salaire","the salary"],["occupé","busy"]],
    sentences: [
      { target: ["Je","travaille","tous","les","jours"], english: "I work every day", extra: ["bureau","souvent"] },
      { target: ["J'ai","une","réunion"], english: "I have a meeting", extra: ["collègue","patron"] },
      { target: ["Je","suis","très","occupé"], english: "I am very busy", extra: ["fatigué","content"] } ] },
  { title: "Phone calls", theme: "phone calls", words: [["le téléphone","the phone"],["appeler","to call"],["le numéro","the number"],["répondre","to answer"],["un message","a message"],["attendre","to wait"],["raccrocher","to hang up"],["plus tard","later"]],
    sentences: [
      { target: ["Je","vous","appelle","plus","tard"], english: "I will call you later", extra: ["maintenant","demain"] },
      { target: ["Attendez","un","moment","s'il","vous","plaît"], english: "Please wait a moment", extra: ["répondez","raccrochez"] },
      { target: ["Laissez","un","message"], english: "Leave a message", extra: ["numéro","téléphone"] } ] },
  { title: "Shopping and clothes", theme: "shopping and clothes", words: [["la chemise","the shirt"],["les chaussures","the shoes"],["la taille","the size"],["essayer","to try on"],["la couleur","the color"],["la robe","the dress"],["grand","big"],["petit","small"]],
    sentences: [
      { target: ["Je","veux","essayer","ça"], english: "I want to try this on", extra: ["acheter","chemise"] },
      { target: ["Cette","chemise","est","trop","grande"], english: "This shirt is too big", extra: ["petite","robe"] },
      { target: ["J'aime","cette","couleur"], english: "I like this color", extra: ["taille","robe"] } ] },
  { title: "Health and body", theme: "health and body", words: [["la tête","the head"],["la main","the hand"],["le ventre","the stomach"],["malade","sick"],["le médecin","the doctor"],["la pharmacie","the pharmacy"],["la douleur","the pain"],["se sentir","to feel"]],
    sentences: [
      { target: ["Je","suis","malade"], english: "I am sick", extra: ["fatigué","content"] },
      { target: ["J'ai","mal","à","la","tête"], english: "My head hurts", extra: ["ventre","main"] },
      { target: ["J'ai","besoin","d'un","médecin"], english: "I need a doctor", extra: ["pharmacie","douleur"] } ] },
  { title: "House and home", theme: "house and home", words: [["la maison","the house"],["la chambre","the room"],["la cuisine","the kitchen"],["la porte","the door"],["la fenêtre","the window"],["la clé","the key"],["propre","clean"],["le voisin","the neighbor"]],
    sentences: [
      { target: ["Où","est","la","clé"], english: "Where is the key", extra: ["porte","fenêtre"] },
      { target: ["La","maison","est","propre"], english: "The house is clean", extra: ["chambre","sale"] },
      { target: ["Ouvrez","la","fenêtre","s'il","vous","plaît"], english: "Open the window please", extra: ["porte","fermez"] } ] },
];

export const ES_UNIT3: LessonData[] = [
  { title: "Work and jobs", theme: "work and jobs", words: [["el trabajo","the job"],["la oficina","the office"],["el jefe","the boss"],["el colega","the colleague"],["la reunión","the meeting"],["trabajar","to work"],["el salario","the salary"],["ocupado","busy"]],
    sentences: [
      { target: ["Trabajo","todos","los","días"], english: "I work every day", extra: ["oficina","siempre"] },
      { target: ["Tengo","una","reunión"], english: "I have a meeting", extra: ["colega","jefe"] },
      { target: ["Estoy","muy","ocupado"], english: "I am very busy", extra: ["cansado","feliz"] } ] },
  { title: "Phone calls", theme: "phone calls", words: [["el teléfono","the phone"],["llamar","to call"],["el número","the number"],["responder","to answer"],["un mensaje","a message"],["esperar","to wait"],["colgar","to hang up"],["más tarde","later"]],
    sentences: [
      { target: ["Te","llamo","más","tarde"], english: "I will call you later", extra: ["ahora","mañana"] },
      { target: ["Espere","un","momento","por","favor"], english: "Please wait a moment", extra: ["responda","cuelgue"] },
      { target: ["Deje","un","mensaje"], english: "Leave a message", extra: ["número","teléfono"] } ] },
  { title: "Shopping and clothes", theme: "shopping and clothes", words: [["la camisa","the shirt"],["los zapatos","the shoes"],["la talla","the size"],["probarse","to try on"],["el color","the color"],["el vestido","the dress"],["grande","big"],["pequeño","small"]],
    sentences: [
      { target: ["Quiero","probarme","esto"], english: "I want to try this on", extra: ["comprar","camisa"] },
      { target: ["Esta","camisa","es","muy","grande"], english: "This shirt is too big", extra: ["pequeña","vestido"] },
      { target: ["Me","gusta","este","color"], english: "I like this color", extra: ["talla","vestido"] } ] },
  { title: "Health and body", theme: "health and body", words: [["la cabeza","the head"],["la mano","the hand"],["el estómago","the stomach"],["enfermo","sick"],["el médico","the doctor"],["la farmacia","the pharmacy"],["el dolor","the pain"],["sentirse","to feel"]],
    sentences: [
      { target: ["Estoy","enfermo"], english: "I am sick", extra: ["cansado","feliz"] },
      { target: ["Me","duele","la","cabeza"], english: "My head hurts", extra: ["estómago","mano"] },
      { target: ["Necesito","un","médico"], english: "I need a doctor", extra: ["farmacia","dolor"] } ] },
  { title: "House and home", theme: "house and home", words: [["la casa","the house"],["la habitación","the room"],["la cocina","the kitchen"],["la puerta","the door"],["la ventana","the window"],["la llave","the key"],["limpio","clean"],["el vecino","the neighbor"]],
    sentences: [
      { target: ["Dónde","está","la","llave"], english: "Where is the key", extra: ["puerta","ventana"] },
      { target: ["La","casa","está","limpia"], english: "The house is clean", extra: ["habitación","sucia"] },
      { target: ["Abra","la","ventana","por","favor"], english: "Open the window please", extra: ["puerta","cierre"] } ] },
];
