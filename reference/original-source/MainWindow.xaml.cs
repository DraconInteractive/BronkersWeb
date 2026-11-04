using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using Bronkers.Core;

namespace Bronkers;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window, INotifyPropertyChanged
{
    public enum TurnPhase
    {
        WaitForPickup,
        PlayerActions,
        SelectDiscard
    }
    
    private Deck _deck;

    public Deck Deck => _deck;

    public ObservableCollection<Card> discardPile { get; } = new();
    private readonly List<Card> selectedFormationCards = new();
    
    public Player[] players { get; set; }

    private int _activePlayer;

    public int ActivePlayer
    {
        get => _activePlayer;
        set
        {
            _activePlayer = value;
            OnPropertyChanged();
        }
    }
    private TurnPhase _phase;
    public TurnPhase Phase
    {
        get => _phase;
        set
        {
            _phase = value;
            OnPropertyChanged();
        }
    }
    
    private string? _statusMessage;
    public string? StatusMessage
    {
        get => _statusMessage;
        set
        {
            _statusMessage = value;
            OnPropertyChanged();
        }
    }

    private const bool automatedTest = false;
    
    public MainWindow()
    {
        InitializeComponent();
        
        PickupDeckButton.Click += (_, _) => Pickup();
        PickupDiscardButton.Click += (_, _) => PickupFromDiscard();
        FinishActionsButton.Click += (_, _) => FinishActions();
        DiscardButton.Click += (_, _) => Discard();
        
        PreviewKeyDown += (_, e) =>                              
        {                                                        
            if (e.Key is not (Key.Left or Key.Right)) return;    
            if (HandList.SelectedItems.Count == 0) return;       
                                                           
            var cards = players[0].hand.cards;                   
            var step = e.Key == Key.Left ? -1 : 1;               
                                                           
            var indices = HandList.SelectedItems.Cast<Card>().Select(cards.IndexOf);                                      
            var ordered = (step < 0 ? indices.Order() :          
                indices.OrderDescending()).ToArray();                    
                                                           
            var leading = ordered[0] + step;                     
            if (leading >= 0 && leading < cards.Count)           
            {                                                    
                foreach (var from in ordered) cards.Move(from,   
                    from + step);                                            
            }                                                    
            e.Handled = true;                                    
        };     
        
        LayDownButton.Click += (_, _) => TryLayDown();

        TableArea.AddHandler(ButtonBase.ClickEvent, new RoutedEventHandler((_, e) =>
        {
            if ((e.OriginalSource as FrameworkElement)?.DataContext is not Formation formation) return;

            if (e.OriginalSource is Button { Name: "ReturnToHandButton" }) ReturnToHand(formation);
            else OnFormationClicked(formation);
        }));
        
        TableArea.AddHandler(Selector.SelectionChangedEvent, new SelectionChangedEventHandler((_, e) =>
        {
            if (e.OriginalSource is not ListBox source) return;

            if (e.AddedItems.Count > 0)
            {
                HandList.UnselectAll();
                UnselectFormationCards(source);
            }

            foreach (Card card in e.RemovedItems) selectedFormationCards.Remove(card);
            foreach (Card card in e.AddedItems) selectedFormationCards.Add(card);
        }));
        
        GoalPicker.SelectionChanged += (_, e) =>
        {
            var oldGoal = e.RemovedItems.Count > 0 ? (GoalConfiguration)e.RemovedItems[0]! : null;
            OnGoalChanged(oldGoal, GoalPicker.SelectedItem as GoalConfiguration);
        };
        
        HandList.SelectionChanged += (_, e) =>
        {
            if (e.AddedItems.Count > 0) UnselectFormationCards();
        };
        
        _deck = new Deck();

        StatusMessage = null;
        
        var playerCount = 2;
        
        players = new Player[playerCount];
        for (int i = 0; i < playerCount; i++)
        {
            players[i] = new Player();
        }

        SetupRound();
        
        DataContext = this;
    }

    private void SetupRound()
    {
        var dealCards = 13;

        selectedFormationCards.Clear();
        discardPile.Clear();
        
        _deck.InitializeCards();
        
        foreach (var player in players)
        {
            player.Reset();
            player.TakeCards(_deck.Deal(dealCards, out _));
        }

        var startingCard = _deck.Deal(1, out _);
        discardPile.Add(startingCard[0]);

        ActivePlayer = 0;
        Phase = TurnPhase.WaitForPickup;
        
        if (automatedTest)
        {
            ProcessAITurn();
        }
    }

    private bool TryEndRound(int winner = -1)
    {
        if (players[ActivePlayer].LaidDown == 1 && players[ActivePlayer].hand.cards.Count == 0)
        {
            SetupRound();
            return true;
        }

        return false;
    }
    
    private int processWait = 800;
    public async void ProcessAITurn()
    {
        var player = players[ActivePlayer];
        
        // Select goal
        if (player.Goal == null)
        {
            var remaining = player.goals.Where(g => !g.completed).ToArray();      
            player.Goal = remaining[Random.Shared.Next(remaining.Length)]; 
        }
        await Task.Delay(processWait);

        // Score cards
        var scores = GetCardScores(player);
        var discardScores = GetCardScores(player, discardPile.Last());
        var cScore = scores.Sum(kvp => kvp.Value);
        // Drop lowest card so its a 13 v 13 comparison
        var discardCScore = discardScores.Sum(kvp => kvp.Value) - discardScores.Min(x => x.Value);

        // Determine pickup
        const float minPickupGain = 0.6f;
        if (discardCScore - cScore > minPickupGain)
        {
            PickupFromDiscard();
        }
        else
        {
            Pickup();
        }
        
        await Task.Delay(processWait);

        if (player.LaidDown == 0)
        {
            bool shelved;
            do
            {
                shelved = false;
                var ranked = GetCardScores(player)
                    .Where(x => !x.Key.IsWild)
                    .OrderByDescending(x => x.Value)
                    .Select(x => x.Key);

                foreach (var card in ranked)
                {
                    if (!TryGetFormation(player, card, out var cards)) continue;

                    var target = player.Goal.formations.FirstOrDefault(f => f.cards.Count == 0 &&
                                                                            f.TrySet(cards));
                    if (target == null) continue;

                    player.RemoveCards(cards);
                    shelved = true;
                    break;
                }
            } while (shelved);
        }
        else
        {
            bool added;
            do
            {
                added = false;
                foreach (var _player in players)
                {
                    if (_player.Goal == null || _player.LaidDown == 0)
                    {
                        continue;
                    }
                    foreach (var form in _player.Goal.formations)
                    {
                        foreach (var card in player.hand.cards.ToArray())
                        {
                            if (!form.TryAdd(card, out var wilds)) continue;

                            player.RemoveCards([card]);
                            player.TakeCards(wilds);
                            added = true;
                        }
                    }
                }
            } while (added);

            if (TryEndRound()) return;
        }
        

        var wentOut = player.hand.cards.Count == 0;
        player.RefreshCanLayDown();
        TryLayDown(player);
        if (wentOut) return;
        FinishActions();
        await Task.Delay(processWait);
        
        // Update scores to account for formation changes
        scores = GetCardScores(player);
        Discard(player, scores.MinBy(x => x.Value).Key);
        await Task.Delay(processWait);
    }

    private Dictionary<Card, float> GetCardScores(Player player, Card? discard = null)
    {
        var twoScore = 10;

        Dictionary<Card, float> scores = new();
        if (discard != null)
        {
            scores[discard] = discard.IsWild ? twoScore : 0;
        }
        
        foreach (var card in player.hand.cards)
        {
            scores[card] = card.IsWild ? twoScore : 0;
        }

        if (player.Goal == null)
        {
            throw new Exception("Null goal in card scores");
        }
        
        var reqSets = player.Goal.formations.Count(x => x is Set && x.cards.Count == 0);
        var reqRuns = player.Goal.formations.Count(x => x is Run && x.cards.Count == 0);

        // Set scoring
        foreach (var card in scores.Keys)
        {
            if (card.Value == 2) continue;
            scores[card] = (scores.Keys.Count(x => x.Value == card.Value) / 3f) * reqSets;
        }

        // Run scoring
        foreach (var card in scores.Keys)
        {
            if (card.Value == 2) continue;
            var cardsInRange = scores.Keys.Count(x => card.suit == x.suit && Math.Abs(card.Value - x.Value) < 4);
            var score = (cardsInRange / 4f) * reqRuns;
            if (scores[card] < score)
            {
                scores[card] = score;
            }
        }

        return scores;
    }

    private bool TryGetFormation(Player player, Card card, out Card[] formation)
    {
        formation = [];
        if (card.IsWild) return false;

        var cards = player.hand.cards;
        var wilds = cards.Where(x => x.IsWild);
        var naturals = cards.Where(x => x.Value == card.Value).ToArray();

        var needsSet = player.Goal?.formations.Any(x => x is Set && x.cards.Count == 0) == true;         
        var set = naturals.Concat(wilds).Take(3).ToArray();
        if (needsSet && naturals.Length >= 2 && set.Length == 3)
        {
            formation = set;
            return true;
        }

        var needsRun = player.Goal?.formations.Any(x => x is Run && x.cards.Count == 0) == true;
        if (needsRun)
        {
            const int runLength = 4;
            const int minNaturals = 3;
            var suited = cards.Where(x => x.suit == card.suit && !x.IsWild).ToArray();
            Card[] best = [];

            // An ace can sit at either end, so it's checked as rank 1 and rank 14
            int[] cardRanks = card.Value == 1 ? [1, 14] : [card.Value];
            foreach (var rank in cardRanks)
            {
                var firstStart = Math.Max(1, rank - (runLength - 1));
                var lastStart = Math.Min(rank, 15 - runLength);
                for (int start = firstStart; start <= lastStart; start++)
                {
                    var windowCards = Enumerable.Range(start, runLength)
                        .Select(r => suited.FirstOrDefault(x => x.Value == (r == 14 ? 1 : r)))
                        .OfType<Card>()
                        .ToArray();

                    var missing = runLength - windowCards.Length;
                    if (windowCards.Length >= minNaturals && missing <= wilds.Count() && windowCards.Length > best.Length)
                    {
                        best = windowCards;
                    }
                }
            }

            if (best.Length > 0)
            {
                formation = [.. best, .. wilds.Take(runLength - best.Length)];
                return true;
            }
        }
        return false;
    }
    
    public void Pickup()
    {
        var player = players[_activePlayer];
        player.TakeCards(_deck.Deal(1, out var remaining));
        if (remaining > 0) // Deck has reached 0
        {
            var top = discardPile.Last();                                     
            _deck.Add(discardPile.SkipLast(1).ToArray(), shuffle: true);      
            discardPile.Clear();                                              
            discardPile.Add(top);                                             
                                                                        
            player.TakeCards(_deck.Deal(remaining, out _));
        }
        
        Phase = TurnPhase.PlayerActions;
    }

    public void PickupFromDiscard()
    {
        var player = players[_activePlayer];
        var card = discardPile.Last();
        player.TakeCards([card]);
        discardPile.Remove(card);
        Phase = TurnPhase.PlayerActions;
    }

    public void FinishActions()
    {
        Phase = TurnPhase.SelectDiscard;
    }

    public void Discard()
    {
        var card = HandList.SelectedItem as Card;
        if (card == null)
        {
            throw new Exception("Invalid UI Discard");
        }
        Discard(players[0], card);
    }

    public void Discard(Player player, Card card)
    {
        discardPile.Add(card);
        player.RemoveCards([card]);
        if (!TryEndRound())
        {
            NextPlayer();
        }
    }
    
    public void DiscardRandom()
    {
        var chosenDiscard = players[ActivePlayer].RemoveCardsRandom(1);
        discardPile.Add(chosenDiscard[0]);
        if (!TryEndRound())
        {
            NextPlayer();
        }
    }

    public void NextPlayer()
    {
        StatusMessage = null;
        if (ActivePlayer == players.Length - 1)
        {
            ActivePlayer = 0;
        }
        else
        {
            ActivePlayer++;
        }
        Phase = TurnPhase.WaitForPickup;
        if (ActivePlayer != 0)
        {
            ProcessAITurn();
        }
        else if (automatedTest)
        {
            ProcessAITurn();
        }
    }
    
    private void OnFormationClicked(Formation formation)
    {
        StatusMessage = null;
        var player = players[0];
        var chosen = HandList.SelectedItems.Cast<Card>().ToArray();
        
        // Temp
        if (formation.cards.Count == 0 && formation.TrySet(chosen))
        {
            player.RemoveCards(chosen);
        }
        else if (formation.cards.Count > 0)
        {
            foreach (var card in chosen)
            {
                if (formation.TryAdd(card, out var swappedWilds))
                {
                    player.RemoveCards([card]);
                    if (swappedWilds.Length > 0)
                    {
                        player.TakeCards(swappedWilds);
                    }
                }
            }
        }
        player.RefreshCanLayDown();
        TryEndRound();
    }

    private void OnGoalChanged(GoalConfiguration? oldGoal, GoalConfiguration? newGoal)
    {
        StatusMessage = null;
        selectedFormationCards.Clear();

        // Move cards from oldGoal's formations to newGoal, or back to the hand.
        if (oldGoal != null)
        {
            List<Card> formationCards = new();
            foreach (var formation in oldGoal.formations)
            {
                foreach (var card in formation.cards)
                {
                    formationCards.Add(card);
                }
                formation.cards.Clear();
            }

            if (formationCards.Count > 0)
            {
                players[0].TakeCards(formationCards.ToArray());
            }
        }
        
        players[0].RefreshCanLayDown();
    }

    private bool TryLayDown()
    {
        var player = players[0];
        return TryLayDown(player);
    }

    private bool TryLayDown(Player player)
    {
        if (player.LaidDown == 1) return false;
        if (!player.CanLayDown) return false;
        player.LaidDown = 1;
        player.RefreshCanLayDown();

        if (player.Goal != null) player.Goal.completed = true;

        TryEndRound(ActivePlayer);
        return true;
    }
    
    private void ReturnToHand(Formation formation)
    {
        var chosen = formation.cards.Where(selectedFormationCards.Contains).ToArray();
        foreach (var card in chosen) formation.cards.Remove(card);
        
        players[0].TakeCards(chosen);
        
        // if chosen brings card total down to an invalid formation, move all formation cards
        if (!formation.IsValid())
        {
            players[0].TakeCards(formation.cards.ToArray());
            formation.cards.Clear();
        }
        
        players[0].RefreshCanLayDown();
    }
    
    private void UnselectFormationCards(ListBox? except = null)
    {
        void Visit(DependencyObject parent)
        {
            for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
            {
                var child = VisualTreeHelper.GetChild(parent, i);
                if (child is ListBox list)
                {
                    if (list != except) list.UnselectAll();
                }
                else Visit(child);
            }
        }

        Visit(TableArea);
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