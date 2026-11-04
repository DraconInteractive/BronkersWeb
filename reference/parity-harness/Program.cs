using Bronkers.Core;
using static System.Console;

static Card C(string s){
  var suitCh=s[^1]; var v=s[..^1];
  var suit = suitCh switch{'H'=>Card.Suit.Hearts,'D'=>Card.Suit.Diamonds,'S'=>Card.Suit.Spades,_=>Card.Suit.Clubs};
  int val = v switch{"A"=>1,"J"=>11,"Q"=>12,"K"=>13,_=>int.Parse(v)};
  return new Card{suit=suit,Value=val};
}
static string N(Card c){ string r=c.Value switch{1=>"A",11=>"J",12=>"Q",13=>"K",_=>c.Value.ToString()}; return r+c.suit.ToString()[0];}
static string L(IEnumerable<Card> cs)=> "["+string.Join(",",cs.Select(N))+"]";
static Card[] H(string s)=> s.Split(' ',StringSplitOptions.RemoveEmptyEntries).Select(C).ToArray();

void SetTry(string label, Formation f, string cards){ var a=H(cards); var ok=f.TrySet(a); WriteLine($"{label}: TrySet({L(a)}) -> {ok} {(ok?L(f.cards):"")}"); }
void AddTry(string label, Formation f, string start, string add){ var a=H(start); if(!f.TrySet(a)) {WriteLine($"{label}: setup failed"); return;} var before=L(f.cards); var c=C(add); var ok=f.TryAdd(c,out var w); WriteLine($"{label}: {before} + {N(c)} -> {ok} {L(f.cards)} swapped={L(w)}"); }

WriteLine("== SET");
SetTry("S1",new Set(),"5H 5S 5D");
SetTry("S2",new Set(),"5H 2C 5D");
SetTry("S3",new Set(),"2H 2C 2D");
SetTry("S4",new Set(),"5H 6H 5D");
SetTry("S5",new Set(),"5H 5S");
SetTry("S6",new Set(),"2C 7H 7S 7D");
AddTry("SA1",new Set(),"5H 2C 5D","5S");
AddTry("SA2",new Set(),"5H 5S 5D","2C");
AddTry("SA3",new Set(),"5H 5S 5D","6H");
AddTry("SA4",new Set(),"2H 2C 2D","9S");
AddTry("SA5",new Set(),"2H 5C 2D","5S");
WriteLine("== RUN");
SetTry("R1",new Run(),"5H 6H 7H 8H");
SetTry("R2",new Run(),"8H 5H 7H 6H");
SetTry("R3",new Run(),"5H 2C 7H 8H");
SetTry("R4",new Run(),"5H 6H 7H 2C");
SetTry("R5",new Run(),"QH KH AH 2C");
SetTry("R6",new Run(),"AH 3H 4H 2C");
SetTry("R7",new Run(),"KH AH 2C 3H");
SetTry("R8",new Run(),"5H 6S 7H 8H");
SetTry("R9",new Run(),"5H 5H 6H 7H");
SetTry("R10",new Run(),"2H 2C 2D 2S");
SetTry("R11",new Run(),"5H 6H 7H");
SetTry("R12",new Run(),"JH QH KH AH");
SetTry("R13",new Run(),"AH 2S 2D 4H");
SetTry("R14",new Run(),"3H 2C 2D 2S");
AddTry("RA1",new Run(),"5H 6H 7H 8H","9H");
AddTry("RA2",new Run(),"5H 6H 7H 8H","4H");
AddTry("RA3",new Run(),"5H 6H 7H 8H","9S");
AddTry("RA4",new Run(),"5H 2C 7H 8H","6H");
AddTry("RA5",new Run(),"5H 6H 7H 2C","4H");
AddTry("RA6",new Run(),"5H 6H 7H 2C","8H");
AddTry("RA7",new Run(),"5H 6H 7H 2C","9H");
AddTry("RA8",new Run(),"QH KH AH 2C","10H");
AddTry("RA9",new Run(),"AH 2C 3H 4H","2D");
AddTry("RA10",new Run(),"5H 6H 7H 8H","2C");
AddTry("RA11",new Run(),"AH 2C 3H 4H 5H 6H 7H 8H 9H 10H JH QH KH","AS");
AddTry("RA12",new Run(),"AH 2C 3H 4H 5H 6H 7H 8H 9H 10H JH QH KH","AH");
AddTry("RA13",new Run(),"10H JH QH KH","AH");
AddTry("RA14",new Run(),"2C 2D 2S 2H","7H");
{ var r=new Run(); r.TrySet(H("3H 4H 5H 6H 7H")); var rm=r.cards[2]; r.cards.Remove(rm); WriteLine($"V1: after removing 5H from [3..7H] -> IsValid={r.IsValid()} {L(r.cards)}"); }
{ var r=new Run(); r.TrySet(H("3H 4H 5H 6H 7H")); r.cards.RemoveAt(0); WriteLine($"V2: after removing 3H -> IsValid={r.IsValid()} {L(r.cards)}"); }
{ var s=new Set(); s.TrySet(H("5H 5S 5D 5C")); s.cards.RemoveAt(0); WriteLine($"V3: set of 4 minus one -> IsValid={s.IsValid()}"); }
{ var r=new Run(); r.TrySet(H("QH KH AH 2C")); WriteLine($"V4: {L(r.cards)} IsValid={r.IsValid()}"); }

WriteLine("== GOAL NAMES");
foreach (var g in new Player().goals) WriteLine($"{g.name} pts={g.points} forms={string.Join(",",g.formations.Select(f=>f.GetType().Name))}");

WriteLine("== AI SCORES");
Dictionary<Card,float> Scores(Player player, Card? discard=null){
    var twoScore = 10;
    Dictionary<Card, float> scores = new();
    if (discard != null) scores[discard] = discard.IsWild ? twoScore : 0;
    foreach (var card in player.hand.cards) scores[card] = card.IsWild ? twoScore : 0;
    var reqSets = player.Goal.formations.Count(x => x is Set && x.cards.Count == 0);
    var reqRuns = player.Goal.formations.Count(x => x is Run && x.cards.Count == 0);
    foreach (var card in scores.Keys){ if (card.Value == 2) continue; scores[card] = (scores.Keys.Count(x => x.Value == card.Value) / 3f) * reqSets; }
    foreach (var card in scores.Keys){ if (card.Value == 2) continue; var cardsInRange = scores.Keys.Count(x => card.suit == x.suit && Math.Abs(card.Value - x.Value) < 4); var score = (cardsInRange / 4f) * reqRuns; if (scores[card] < score) scores[card] = score; }
    return scores;
}
bool TryGetFormation(Player player, Card card, out Card[] formation){
    formation = [];
    if (card.IsWild) return false;
    var cards = player.hand.cards;
    var wilds = cards.Where(x => x.IsWild);
    var naturals = cards.Where(x => x.Value == card.Value).ToArray();
    var needsSet = player.Goal?.formations.Any(x => x is Set && x.cards.Count == 0) == true;
    var set = naturals.Concat(wilds).Take(3).ToArray();
    if (needsSet && naturals.Length >= 2 && set.Length == 3){ formation = set; return true; }
    var needsRun = player.Goal?.formations.Any(x => x is Run && x.cards.Count == 0) == true;
    if (needsRun){
        const int runLength = 4; const int minNaturals = 3;
        var suited = cards.Where(x => x.suit == card.suit && !x.IsWild).ToArray();
        Card[] best = [];
        int[] cardRanks = card.Value == 1 ? [1, 14] : [card.Value];
        foreach (var rank in cardRanks){
            var firstStart = Math.Max(1, rank - (runLength - 1));
            var lastStart = Math.Min(rank, 15 - runLength);
            for (int start = firstStart; start <= lastStart; start++){
                var windowCards = Enumerable.Range(start, runLength).Select(r => suited.FirstOrDefault(x => x.Value == (r == 14 ? 1 : r))).OfType<Card>().ToArray();
                var missing = runLength - windowCards.Length;
                if (windowCards.Length >= minNaturals && missing <= wilds.Count() && windowCards.Length > best.Length) best = windowCards;
            }
        }
        if (best.Length > 0){ formation = [.. best, .. wilds.Take(runLength - best.Length)]; return true; }
    }
    return false;
}
Player P(string hand, int goalIdx){ var p=new Player(); p.TakeCards(H(hand)); p.Goal=p.goals[goalIdx]; return p; }
string SS(Dictionary<Card,float> d)=> string.Join(", ", d.Select(kv=>$"{N(kv.Key)}={kv.Value.ToString("R")}"));

{ var p=P("5H 5S 6H 7H 2H",2); var s=Scores(p); WriteLine($"SC1 (1S 1R): {SS(s)} | min={N(s.MinBy(x=>x.Value).Key)} sum={s.Sum(kv=>kv.Value).ToString("R")}"); }
{ var p=P("5H 5S 6H 7H 2H",0); var s=Scores(p); WriteLine($"SC2 (2S): {SS(s)}"); }
{ var p=P("5H 5S 6H 7H 2H",3); var s=Scores(p); WriteLine($"SC3 (2R): {SS(s)}"); }
{ var p=P("5H 5S 6H 7H 2H",2); p.Goal.formations[0].TrySet(H("9C 9D 9S")); var s=Scores(p); WriteLine($"SC4 (1S 1R, set filled): {SS(s)}"); }
{ var p=P("KH 9S 2C 4D",2); p.Goal.formations[0].TrySet(H("9C 9D 9S")); p.Goal.formations[1].TrySet(H("5H 6H 7H 8H")); var s=Scores(p); WriteLine($"SC5 (all filled): {SS(s)} | discard={N(s.MinBy(x=>x.Value).Key)}"); }
{
  var p=P("3H 3S 7D 9C 10C JS KH 4D 8S QC 6D AH 5S",2);
  var sc=Scores(p); var cS=sc.Sum(kv=>kv.Value);
  foreach (var d in new[]{"3D","2D","8D","5D","KC","JD","9H","QS"}){
    var ds=Scores(p,C(d)); var dC=ds.Sum(kv=>kv.Value)-ds.Min(x=>x.Value);
    WriteLine($"PK {d}: cScore={cS:R} discardCScore={dC:R} diff={(dC-cS):R} takeDiscard={(dC-cS>0.6f)}");
  }
}
void TGF(string label,string hand,int goal,string card){ var p=P(hand,goal); var c=p.hand.cards.First(x=>N(x)==card); var ok=TryGetFormation(p,c,out var f); WriteLine($"{label}: hand={L(p.hand.cards)} goal={p.Goal.name} card={card} -> {ok} {L(f)}"); }
TGF("TG1","7H 7S 2C 9D KS",0,"7H");
TGF("TG2","7H 9D 2C 2S KS",0,"7H");
TGF("TG3","5H 6H 8H 2C KS",3,"5H");
TGF("TG4","5H 6H 8H KS",3,"5H");
TGF("TG5","AH QH KH 2C",3,"AH");
TGF("TG6","AH 3H 4H 9S",3,"AH");
TGF("TG7","7H 7S 6H 8H 9H",2,"7H");
TGF("TG8","7H 7S 6H 8H 9H",3,"7H");
TGF("TG9","2C",2,"2C");
TGF("TG10","4H 5H 6H 7H 8H",3,"6H");
TGF("TG11","7H 7S 9D",0,"7H");
