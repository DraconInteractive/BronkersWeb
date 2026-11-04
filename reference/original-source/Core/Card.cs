namespace Bronkers.Core;

public class Card
{
    public enum Suit
    {
        Hearts,
        Diamonds,
        Spades,
        Clubs
    }
    
    public Suit suit { get; set; }

    private int _value;

    public int Value
    {
        get => _value;

        set => _value = Math.Clamp(value, 1, 13);
    }

    public bool IsWild => _value == 2;
    public string DisplayStr()
    {
        if (_value > 1 && _value < 11)
        {
            return $"{_value} of {suit}";
        }
        else
        {
            string nomen;
            switch (_value)
            {
                case 1:
                    nomen = "Ace";
                    break;
                case 11:
                    nomen = "Jack";
                    break;
                case 12:
                    nomen = "Queen";
                    break;
                case 13:
                    nomen = "King";
                    break;
                default:
                    nomen = "Invalid";
                    break;
            }

            return $"{nomen} of {suit}";
        }
    }
}