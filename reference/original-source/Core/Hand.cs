using System.Collections.ObjectModel;

namespace Bronkers.Core;

public class Hand
{
    public ObservableCollection<Card> cards { get; } = new();
    
}