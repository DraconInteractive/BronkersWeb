using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace Bronkers.Core;

public class Deck : INotifyPropertyChanged
{
    private Stack<Card> _cards = new();
    public int Count => _cards.Count;
    
    public Deck(bool doShuffle = true)
    {
        InitializeCards(doShuffle);
        Console.WriteLine($"Deck created with {_cards.Count} cards");
    }

    public Deck(Card[] startingCards)
    {
        _cards = new Stack<Card>(startingCards);
    }

    public void InitializeCards(bool doShuffle = true)
    {
        _cards.Clear();
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Hearts, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Diamonds, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Spades, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Clubs, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Hearts, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Diamonds, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Spades, Value = v });
        }
        
        for (int v = 1; v <= 13; v++)
        {
            _cards.Push(new Card() { suit = Card.Suit.Clubs, Value = v });
        }

        if (doShuffle)
        {
            Shuffle();
        }
    }
    
    public void Shuffle()
    {
        Card[] arr = _cards.ToArray();
        Random.Shared.Shuffle(arr);
        _cards = new Stack<Card>(arr);
    }
    
    public Card[] Deal(int amount, out int remainingCards)
    {
        int dealCount = Math.Min(amount, _cards.Count);
        remainingCards = amount - dealCount;
        List<Card> dealHand = new();
        for (int i = 0; i < dealCount; i++)                               
        {                                                                 
            dealHand.Add(_cards.Pop());                                   
        } 

        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Count)));
        return dealHand.ToArray();
    }

    public void Add(Card[] cardsToAdd, bool shuffle = false)
    {
        foreach (var card in cardsToAdd)
        {
            _cards.Push(card);
        }

        if (shuffle)
        {
            Shuffle();
        }
        
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Count)));
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