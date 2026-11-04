using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace Bronkers;

/// <summary>
/// Lays children out left to right, tilting and dropping them away from the centre to form a fan.
/// </summary>
public class FanPanel : Panel
{
    public double AnglePerCard { get; set; } = 1.2;
    public double DropPerCard { get; set; } = 0.5;

    private double OffsetFromCentre(int index) => index - (InternalChildren.Count - 1) / 2.0;

    protected override Size MeasureOverride(Size availableSize)
    {
        double width = 0;
        double height = 0;
        foreach (UIElement child in InternalChildren)
        {
            child.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
            width += child.DesiredSize.Width;
            height = Math.Max(height, child.DesiredSize.Height);
        }

        double edge = OffsetFromCentre(0);
        return new Size(width, height + DropPerCard * edge * edge);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        double x = 0;
        for (int i = 0; i < InternalChildren.Count; i++)
        {
            var child = InternalChildren[i];
            double offset = OffsetFromCentre(i);

            child.RenderTransformOrigin = new Point(0.5, 0.5);
            child.RenderTransform = new RotateTransform(offset * AnglePerCard);
            child.Arrange(new Rect(x, DropPerCard * offset * offset, child.DesiredSize.Width, child.DesiredSize.Height));
            x += child.DesiredSize.Width;
        }

        return finalSize;
    }
}