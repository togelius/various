(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.StortorgetDanish = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // What the invaders shout. Real Danish (æ, ø, å, sgu, pyt, hold da op) about
  // the rivalry: 1658 and the frozen Belts, Lund 1676, the Kalmar Union, EM '92
  // in Gothenburg, Bron/Broen, Riget's Stig Helmer, Olsen-banden, Systembolaget,
  // lagom, IKEA rugs named after Danish towns, and the stronger krone.
  // Stock lines per attacker type live in levels.js; these pools add to them.
  // Keep every line short enough for a speech bubble (36 characters).

  const CHATTER = {
    basic: [
      "Hej hej, svensker!", "Hold da op, hvor er her fladt!", "Nå, er det her Malmö?",
      "Det er sgu hyggeligt her!", "Vi er bare på dagstur!", "Hvor er Netto?",
      "Jeg har en plan!", "Skidegodt, Egon!", "Pyt med det!", "Kom så, Danmark!",
      "Vi er røde, vi er hvide!", "Jeres kroner er legepenge!", "Lagom? Kedeligt!",
      "Hvorfor står I altid i kø?", "Systembolaget har lukket!", "I har ikke rigtig øl!",
      "Ven er dansk!", "Tycho Brahe var dansker!", "Kalmarunionen var bedre!",
      "IKEA-tæpper med danske bynavne?!", "Tørrer I fødderne på Danmark?",
      "Vi taler ikke med kartofler!", "Halvfems! Prøv at sige det!", "Det er da fedt!",
    ],
    runner: [
      "Øresundstoget er forsinket!", "Jeg har pendlerkort!", "Hurtigere end en Volvo!",
      "Sidste tog til Kastrup!", "Jeg bor billigt i Malmö!", "Broen koster en formue!",
      "Saga! Vent på mig!", "Martin Rohde var bedre!", "Halvt dansk, halvt svensk!",
      "Liget ligger på grænsen!", "Cykelsti? Hvor?", "Uden hjelm, selvfølgelig!",
      "Christiania-cykel på vej!", "Vi var i Göteborg i '92!",
    ],
    tank: [
      "Lund 1676 var uafgjort!", "Kronborg står endnu!", "Smørrebrød på rugbrød!",
      "Leverpostej giver kræfter!", "Flæskesteg i maven!", "Remoulade på alt!",
      "Gammel Dansk til morgenmad!", "Kong Frederik sender mig!", "Isen var for tynd i 1658!",
      "Kristianstad er opkaldt efter os!", "Tilbage til 1657!", "Schmeichel tog den!",
      "Margrethe ville være stolt!", "En rød pølse, tak!",
    ],
    boss: [
      "Jeg er Store Dansker!", "Kalmarunionen genopstår!", "Skåne, Halland, Blekinge!",
      "Hele Skåneland er mit!", "Riget kalder!", "Helmer, jeg kommer!",
      "Danskjävlar? Ja tak!", "EM-trofæet er med!", "Hesten bliver til pølser!",
      "Kronen er stærkere!", "Jantelov gælder ikke mig!", "Jeg har en plan, Kalle!",
    ],
  };

  const EVENTS = {
    defeat: [
      "Av for pokker!", "Hold da helt ferie!", "Øv bøv!", "Det var sgu uheldigt!",
      "Pyt…", "Jeg vil hjem til mor!", "Hils Helmer!", "Jeg tager toget hjem.", "Uha!",
      "For fanden da!", "Det var ikke fair!", "Puha!",
    ],
    leak: [
      "Skåne er dansk igen!", "Vi har torvet!", "Hesten er vores!", "Kalle, flyt dig!",
      "Første runde til Danmark!", "Mål! Som i '92!", "Danish Dynamite!", "Skål for Skåne!",
    ],
    knockback: [
      "Hov hov hov!", "Det blæser sgu!", "Ikke tilbage til Kastrup!", "Vinden er svensk!",
      "Uha, min frisure!", "Hold da op!",
    ],
    fika: [
      "Har I wienerbrød?", "Vi kalder det hygge!", "Er der kage til?", "Hyggeligt, altså!",
      "En lille en til kaffen?",
    ],
    slow: [
      "Hjernefrys!", "Med guf, tak!", "Og en flødebolle!", "Is i oktober?!", "Koldt, koldt, koldt!",
      "Er det softice?",
    ],
    fireworks: [
      "Nytårsaften?!", "Hold da op, raketter!", "Er det Tivoli?", "Ligner Roskilde Festival!",
      "Det er sgu for meget!", "Amerikanere!",
    ],
    gust: ["Det blæser altid i Skåne!", "Min hue!", "Vi har også blæst!", "Øresund, stop!"],
    home: [
      "Okay, okay, vi går!", "Tilbage over broen!", "Hvad koster broen?", "Vi ses på Strøget!",
      "Hej hej, Malmö!", "Jeg tager Øresundstoget!", "Ingen kø på broen, håber jeg!",
    ],
    splash: ["Jeg kan ikke svømme!", "Vandet er svensk!", "Som i Nyhavn!", "Havfruen, hjælp!", "Plask! Øv!"],
    bossIntro: ["Kamelåsååå!", "Riget kalder!", "Kalmarunionen genopstår!", "Danskjävlar? Ja tak!"],
  };

  // A few lines answer the edition the player chose.
  const MODE = {
    american: [
      "Hvad er freedom fries?", "LEGO er dansk, cowboy!", "Vi har også hotdogs!",
      "Danish? Det hedder wienerbrød!", "Grønland er ikke til salg!",
    ],
    skanska: [
      "Hvad betyder ålahue?", "I taler jo næsten dansk!", "Rulle-hvad for noget?",
      "Bonnaröv? Selv!", "Endelig nogen der forstår os!",
    ],
  };

  // The first Dane on a street sometimes comments on where they are.
  const ROUTES = {
    centralen: ["Øresundstoget er sent!", "Næste station: Malmö C!", "Billetkontrol? Nej tak!", "Vi tog toget over broen!"],
    norravallgatan: ["Vi kom med båden!", "Hvor er Nyhavn?", "Kanalen er mindre end vores!"],
    lillatorg: ["Lilla Torg? Hyggeligt!", "En øl på Lilla Torg!", "Udeservering, ja tak!"],
    sodergatan: ["Strøget er længere!", "Er det her en gågade?", "Hvor er Magasin?"],
    baltzarsgatan: ["Hvor er vi henne?", "Den vej, Egon!"],
    djaknegatan: ["Sankt Petri? Vi har Vor Frue!", "Kirken er flot, altså!"],
  };

  return { CHATTER, EVENTS, MODE, ROUTES };
});
