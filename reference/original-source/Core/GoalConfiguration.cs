using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace Bronkers.Core;

public abstract class Formation
{
    public ObservableCollection<Card> cards { get; protected set; } = new();

    public abstract bool TrySet(Card[] _cards);
    public abstract bool TryAdd(Card card, out Card[] swappedWilds);                                                                               
    public abstract bool IsValid();
    
    protected bool TrySwapWild(Card card, out Card[] swappedWilds)
    {
        swappedWilds = [];
        if (card.IsWild || cards.All(x => x.IsWild))
        {
            return false;
        }

        for (int i = 0; i < cards.Count; i++)
        {
            var wild = cards[i];
            if (!wild.IsWild)
            {
                continue;
            }

            cards[i] = card;
            if (IsValid())
            {
                swappedWilds = [wild];
                return true;
            }

            cards[i] = wild;
        }

        return false;
    }
}

public class Set : Formation
{
    public override bool TrySet(Card[] _cards)
    {
        if (_cards.Length < 3)
        {
            return false;
        }

        // default means its all 2s
        var coreValue = _cards.FirstOrDefault(x => x.Value != 2)?.Value ?? _cards[0].Value; 
        var match = _cards.All(x => x.Value == coreValue || x.IsWild);
        if (match)
        {
            cards.Clear();
            foreach (var card in _cards)
            {
                cards.Add(card);
            }

            return true;
        }
        else
        {
            return false;
        }
    }

    public override bool TryAdd(Card card, out Card[] swappedWilds)
    {
        swappedWilds = [];
        if (cards.Count < 3)
        {
            return false; // Only add to existing valid collections
        }

        var core = cards.FirstOrDefault(x => !x.IsWild);                                                                                           
        if (core != null && card.Value != core.Value && !card.IsWild)                                                                              
        {                                                                                                                                          
            return false; // Doesnt match the set                                                                                                  
        }                                                                                                                                          
                                                                                                                                                 
        if (TrySwapWild(card, out swappedWilds))                                                                                                   
        {                                                                                                                                          
            return true;                                                                                                                           
        }                                                                                                                                          
                                                                                                                                                 
        cards.Add(card);                                                                                                                           
        return true;   
    }

    public override bool IsValid()
    {
        if (cards.Count < 3) return false;

        return cards.Where(x => !x.IsWild).Select(x => x.Value).Distinct().Count() <= 1;
    }
}

public class Run : Formation
{
    public override bool TrySet(Card[] _cards)
    {
        if (_cards.Length < 4)
        {
            return false;
        }
        
        bool suitMatch = _cards.Where(x => !x.IsWild).Select(x => x.suit).Distinct().Count() <= 1;
        if (!suitMatch)
        {
            return false;
        }

        var ordered = InRunOrder(_cards, false) ?? InRunOrder(_cards, true);

        if (ordered == null)
        {
            return false;
        }
        
        cards.Clear();
        foreach (var card in ordered)
        {
            cards.Add(card);
        }

        return true;
    }

     public override bool TryAdd(Card card, out Card[] swappedWilds)                                                                                                         
      {             
          swappedWilds = [];
          
          if (cards.Count < 4)                                                                                                                       
          {                                                                                                                                          
              return false;                                                                                                                          
          }                                                                                                                                          
                                                                                                                                                     
          var natural = cards.FirstOrDefault(x => !x.IsWild);                                                                                        
          if (natural != null && card.suit != natural.suit && !card.IsWild)                                                                          
          {                                                                                                                                          
              return false;                                                                                                                          
          }                                                                                                                                          
                         
          if (TrySwapWild(card, out swappedWilds))                                                                                                   
          {                                                                                                                                          
              return true;                                                                                                                           
          }   
          
          // A second ace can only go on the top of a full run                                                                                       
          if (card.Value == 1 && cards.Count == 13 && cards[0].Value == 1)                                                                           
          {                                                                                                                                          
              cards.Add(card);                                                                                                                       
              return true;                                                                                                                           
          }                                                                                                                                          
                                                                                                                                                     
          Card[] candidates = [.. cards, card];                                                                                                      
          var ordered = InRunOrder(candidates, false) ?? InRunOrder(candidates, true);                                                               
                                                                                                                                                     
          // Cards already on the table keep their places, so a natural can't push a wild along                                                      
          if (ordered == null || !ordered.Where(x => x != card).Select(x => x.IsWild).SequenceEqual(cards.Select(x => x.IsWild)))                    
          {                                                                                                                                          
              return false;                                                                                                                          
          }                                                                                                                                          
                                                                                                                                                     
          cards.Clear();                                                                                                                             
          foreach (var c in ordered)                                                                                                                 
          {                                                                                                                                          
              cards.Add(c);                                                                                                                          
          }                                                                                                                                          
                                                                                                                                                     
          return true;                                                                                                                               
      }                   

        public override bool IsValid()                                                                                                                 
      {                                                                                                                                              
          if (cards.Count < 4) return false;                                                                                                         
          if (cards.Where(x => !x.IsWild).Select(x => x.suit).Distinct().Count() > 1) return false;                                                  
                                                                                                                                                     
          bool FitsFrom(int startRank)                                                                                                               
          {                                                                                                                                          
              if (startRank + cards.Count - 1 > 14) return false;                                                                                    
                                                                                                                                                     
              for (int i = 0; i < cards.Count; i++)                                                                                                  
              {                                                                                                                                      
                  int rank = startRank + i;                                                                                                          
                  if (!cards[i].IsWild && cards[i].Value != (rank == 14 ? 1 : rank)) return false;                                                   
              }                                                                                                                                      
                                                                                                                                                     
              return true;                                                                                                                           
          }                                                                                                                                          
                                                                                                                                                     
          return Enumerable.Range(1, 14).Any(FitsFrom);                                                                                              
      } 

    private static Card[]? InRunOrder(Card[] candidates, bool aceHigh)                                                 
      {                                                        
          int Rank(Card x) => aceHigh && x.Value == 1 ? 14 : x.Value;                                                 
                                                               
          var naturals = candidates.Where(x => !x.IsWild).OrderBy(Rank).ToArray();                      
          var wilds = new Queue<Card>(candidates.Where(x => x.IsWild));                                              
                                                               
          if (naturals.Length == 0)                            
          {                                                    
              return candidates;                               
          }                                                    
                                                               
          var ordered = new List<Card> { naturals[0] };        
          for (int i = 1; i < naturals.Length; i++)            
          {                                                    
              int gap = Rank(naturals[i]) - Rank(naturals[i - 1]) - 1;                                                 
              if (gap < 0 || gap > wilds.Count)                
              {                                                
                  return null; // Duplicate value, or not enough wilds to bridge                                   
              }                                                
                                                               
              for (int j = 0; j < gap; j++)                    
              {                                                
                  ordered.Add(wilds.Dequeue());                
              }                                                
                                                               
              ordered.Add(naturals[i]);                        
          }                                                    
                                                               
          // Leftover wilds extend the low end first, then the high end                                                 
          for (int rank = Rank(naturals[0]); rank > 1 && wilds.Count > 0; rank--)                                 
          {                                                    
              ordered.Insert(0, wilds.Dequeue());              
          }                                                    
                                                               
          for (int rank = Rank(naturals[^1]); rank < 14 && wilds.Count > 0; rank++)                                 
          {                                                    
              ordered.Add(wilds.Dequeue());                    
          }                                                    
                                                               
          return wilds.Count == 0 ? ordered.ToArray() : null;  
      }    
}

public class GoalConfiguration : INotifyPropertyChanged
{
    public ObservableCollection<Formation> formations { get; } = new();

    public int points { get; } // Rewards for achieving lay down
    public string name { get; }
    public GoalConfiguration(int reqSets, int reqRuns, int points)
    {
        for (int i = 0; i < reqSets; i++) formations.Add(new Set());
        for (int i = 0; i < reqRuns; i++) formations.Add(new Run());
        this.points = points;
        
        name = string.Join(" ", new[]
        {
            reqSets > 0 ? $"{reqSets}S" : null,
            reqRuns > 0 ? $"{reqRuns}R" : null
        }.Where(x => x != null));
    }

    public bool IsComplete => formations.All(x => x.cards.Count > 0);
    
    private bool _completed;                                 
    public bool completed                                    
    {                                                        
        get => _completed;                                   
        set                                                  
        {                                                    
            _completed = value;                              
            PropertyChanged?.Invoke(this, new                
                PropertyChangedEventArgs(nameof(completed)));            
        }                                                    
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    protected bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }
}