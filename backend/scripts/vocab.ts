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
