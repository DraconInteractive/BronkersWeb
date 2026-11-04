using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace Bronkers.Core;

public class Player : INotifyPropertyChanged
{
    public Hand hand { get; private set; }

    private int _laidDown;

    // Total record
    public GoalConfiguration[] goals { get; private set; }

    // Reference to the current goal
    private GoalConfiguration? _goal;

    public GoalConfiguration? Goal
    {
        get => _goal;
        set 
        {
            _goal = value;
            OnPropertyChanged(nameof(Goal));
        }
    }
    
    public int LaidDown
    {
        get => _laidDown;
        set
        {
            _laidDown = value;
            OnPropertyChanged();
        }
    }

    private bool _canLayDown;

    public bool CanLayDown
    {
        get => _canLayDown;
        set
        {
            _canLayDown = value;
            OnPropertyChanged();
        }
    }

    public void RefreshCanLayDown()
    {
        CanLayDown = LaidDown == 0 && Goal?.IsComplete == true;
    }
    
    public Player()
    {
        hand = new Hand();
        
        goals =
        [
            new GoalConfiguration(2, 0, 1),
            new GoalConfiguration(3, 0, 1),
            new GoalConfiguration(1, 1, 3),
            new GoalConfiguration(0, 2, 3),
            new GoalConfiguration(2, 1, 5),
            new GoalConfiguration(4, 0, 5),
            new GoalConfiguration(3, 1, 8),
            new GoalConfiguration(1, 2, 8),
            new GoalConfiguration(0, 3, 10),
            new GoalConfiguration(2, 2, 10),
        ];
    }

    public void Reset()
    {
        LaidDown = 0;
        if (Goal != null)
        {
            foreach (var formation in Goal.formations)
            {
                formation.cards.Clear();
            }
        }

        Goal = null;
        RefreshCanLayDown();
        hand.cards.Clear();
    }
    
    public void TakeCards(Card[] cards)
    {
        foreach (var card in cards)
        {
            hand.cards.Add(card);
        }
    }

    public Card[] RemoveCards(Card[] cardsToRemove)
    {
        foreach (var card in cardsToRemove)
        {
            hand.cards.Remove(card);
        }

        return cardsToRemove;
    }

    public Card[] RemoveCardsRandom(int amount)
    {
        var chosen = hand.cards.OrderBy(_ => Random.Shared.Next()).Take(amount).ToArray();
        return RemoveCards(chosen);
    }
    
    public void PrintHand()
    {
        foreach (var card in hand.cards)
        {
            Console.WriteLine($" - {card.DisplayStr()}");
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