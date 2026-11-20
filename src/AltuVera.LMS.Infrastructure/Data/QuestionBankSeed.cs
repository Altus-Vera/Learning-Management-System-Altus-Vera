using System.Text.Json;
using System.Text.Json.Nodes;
using AltuVera.LMS.Domain.Entities.Assessment;
using Microsoft.EntityFrameworkCore;

namespace AltuVera.LMS.Infrastructure.Data;

/// Seeds a question bank for every course and upgrades existing quizzes to draw from it.
public static class QuestionBankSeed
{
    private record Q(string Category, string Text, string[] Options, int Correct, string? Explanation = null);

    private static readonly Q[] Strategy =
    [
        new("Strategic analysis", "Which of the following best describes a SWOT analysis?", ["A financial forecasting model", "An assessment of strengths, weaknesses, opportunities and threats", "A pricing strategy", "A marketing channel"], 1),
        new("Strategic analysis", "Porter’s Five Forces is primarily used to analyse…", ["Industry competitiveness", "Employee motivation", "Cash flow", "Product design"], 0),
        new("Strategic direction", "A mission statement describes…", ["Quarterly targets", "The organisation’s fundamental purpose", "Tax obligations", "Board composition"], 1),
        new("Competitive strategy", "Which strategy focuses on offering products at the lowest cost in the industry?", ["Differentiation", "Focus", "Cost leadership", "Diversification"], 2),
        new("Strategic analysis", "PESTEL analysis examines the…", ["Internal resources", "External macro environment", "Competitor pricing", "Supply chain costs"], 1),
        new("Strategic direction", "A vision statement primarily expresses…", ["What the organisation aspires to become", "Last year’s results", "The organisational chart", "The marketing budget"], 0),
        new("Competitive strategy", "Differentiation strategy relies mainly on…", ["Being the cheapest producer", "Offering unique value customers will pay more for", "Reducing the product range", "Avoiding competition"], 1),
        new("Competitive strategy", "A focus strategy targets…", ["The whole market", "A narrow market segment", "Only overseas markets", "Government buyers only"], 1),
        new("Strategic analysis", "In Porter’s Five Forces, high buyer power typically…", ["Raises industry profitability", "Lowers industry profitability", "Has no effect", "Eliminates rivals"], 1),
        new("Strategic analysis", "The threat of new entrants is lower when…", ["Barriers to entry are high", "Capital requirements are low", "Products are undifferentiated", "Switching costs are low"], 0),
        new("Strategic analysis", "Which tool analyses a firm’s internal activities to find sources of advantage?", ["Value chain analysis", "PESTEL", "Ansoff matrix", "Break-even analysis"], 0),
        new("Resource-based view", "In the VRIO framework, the “R” stands for…", ["Revenue", "Rarity", "Risk", "Return"], 1),
        new("Resource-based view", "A resource gives sustained competitive advantage when it is valuable, rare, inimitable and…", ["Cheap", "Organised to be exploited", "Outsourced", "Publicly available"], 1),
        new("Growth strategy", "In the Ansoff matrix, selling existing products in new markets is…", ["Market penetration", "Product development", "Market development", "Diversification"], 2),
        new("Growth strategy", "Which Ansoff strategy carries the highest risk?", ["Market penetration", "Market development", "Product development", "Diversification"], 3),
        new("Portfolio analysis", "In the BCG matrix, a business with high market share in a low-growth market is a…", ["Star", "Cash cow", "Question mark", "Dog"], 1),
        new("Portfolio analysis", "A “question mark” in the BCG matrix has…", ["Low share in a high-growth market", "High share in a high-growth market", "Low share in a low-growth market", "High share in a low-growth market"], 0),
        new("Growth strategy", "Acquiring a supplier is an example of…", ["Horizontal integration", "Backward vertical integration", "Forward vertical integration", "Unrelated diversification"], 1),
        new("Growth strategy", "Merging with a direct competitor is…", ["Horizontal integration", "Vertical integration", "Conglomerate diversification", "Outsourcing"], 0),
        new("Growth strategy", "A strategic alliance where two firms create a new jointly owned company is a…", ["Franchise", "Joint venture", "Licence", "Merger"], 1),
        new("Strategy implementation", "The McKinsey 7-S framework includes Strategy, Structure, Systems, Shared values, Style, Staff and…", ["Sales", "Skills", "Suppliers", "Shareholders"], 1),
        new("Strategy implementation", "The Balanced Scorecard measures performance from financial, customer, internal process and … perspectives.", ["Learning and growth", "Legal", "Environmental", "Marketing"], 0),
        new("Strategy implementation", "Lewin’s change model consists of unfreeze, change and…", ["Review", "Refreeze", "Restart", "Reward"], 1),
        new("Strategy implementation", "Resistance to change is best reduced by…", ["Ignoring concerns", "Communication and involvement", "Faster implementation", "Reducing training"], 1),
        new("Stakeholders", "Mendelow’s matrix maps stakeholders by…", ["Age and income", "Power and interest", "Cost and benefit", "Risk and return"], 1),
        new("Stakeholders", "Stakeholders with high power and high interest should be…", ["Ignored", "Kept informed only", "Managed closely", "Kept satisfied only"], 2),
        new("Corporate governance", "Corporate governance is mainly concerned with…", ["Product design", "How companies are directed and controlled", "Advertising campaigns", "Inventory levels"], 1),
        new("Corporate governance", "Agency theory addresses conflicts between…", ["Customers and suppliers", "Owners and managers", "Employees and unions", "Governments and banks"], 1),
        new("Strategic direction", "SMART objectives are Specific, Measurable, Achievable, Relevant and…", ["Simple", "Time-bound", "Targeted", "Tested"], 1),
        new("Competitive strategy", "Being “stuck in the middle” according to Porter means…", ["Pursuing no clear generic strategy", "Operating in two countries", "Having medium market share", "Using two suppliers"], 0),
        new("Global strategy", "A transnational strategy aims to achieve…", ["Only local responsiveness", "Only global efficiency", "Both global efficiency and local responsiveness", "Exporting only"], 2),
        new("Global strategy", "Which is a common reason firms internationalise?", ["To reduce market size", "To access new markets and resources", "To avoid economies of scale", "To increase tariffs"], 1),
        new("Innovation", "Disruptive innovation typically begins by…", ["Targeting the most demanding customers", "Serving overlooked or low-end segments", "Raising prices", "Copying incumbents exactly"], 1),
        new("Innovation", "A first-mover advantage can come from…", ["Higher imitation", "Building brand loyalty and scale early", "Waiting for standards", "Lower R&D"], 1),
        new("Strategic analysis", "Scenario planning is used to…", ["Predict one exact future", "Prepare for several plausible futures", "Calculate tax", "Set salaries"], 1),
        new("Corporate strategy", "Synergy means that…", ["The combined value exceeds the sum of the parts", "Costs always increase", "Firms must merge", "Profits are shared equally"], 0),
        new("Corporate strategy", "Related diversification is most likely to create value through…", ["Shared capabilities and resources", "Random investments", "Higher overheads", "Lower quality"], 0),
        new("Ethics & CSR", "Corporate social responsibility refers to…", ["Maximising short-term profit only", "A firm’s responsibilities to society beyond legal requirements", "Avoiding taxes", "Reducing wages"], 1),
        new("Ethics & CSR", "The triple bottom line considers people, planet and…", ["Price", "Profit", "Product", "Promotion"], 1),
        new("Strategy implementation", "A matrix structure is characterised by…", ["A single chain of command", "Dual reporting lines", "No managers", "Only functional departments"], 1),
    ];

    private static Q[] Generic(string subject, string[] topics) =>
        topics.Select((t, i) => new Q(i < topics.Length / 2 ? "Fundamentals" : "Applications",
            $"In {subject}, which statement about {t} is correct?",
            [$"{t} is a core concept studied in this module", $"{t} is unrelated to {subject}", $"{t} only applies to hardware manufacturing", $"{t} was removed from the syllabus"], 0,
            $"{t} is covered in the lecture notes for this module.")).ToArray();

    private static readonly Dictionary<string, Q[]> Banks = new()
    {
        ["BS401.3"] = Strategy,
        ["CS404.3"] =
        [
            new("Fundamentals", "Amdahl’s law describes…", ["The maximum speed-up from parallelising part of a program", "Network latency", "Memory fragmentation", "Disk throughput"], 0),
            new("Fundamentals", "A race condition occurs when…", ["Threads finish in a fixed order", "The outcome depends on the timing of concurrent operations", "A program runs too slowly", "Memory is full"], 1),
            new("Fundamentals", "A mutex is used to…", ["Encrypt data", "Ensure mutual exclusion for a critical section", "Compress files", "Schedule disks"], 1),
            new("Fundamentals", "Deadlock requires mutual exclusion, hold and wait, no pre-emption and…", ["Circular wait", "Starvation", "Paging", "Caching"], 0),
            new("Models", "MapReduce splits processing into…", ["Fetch and decode", "Map and reduce phases", "Read and write", "Encode and decode"], 1),
            new("Models", "In message passing systems, processes communicate by…", ["Sharing global variables", "Sending and receiving messages", "Using the same stack", "Writing to the BIOS"], 1),
            new("Models", "MPI is primarily used for…", ["Web design", "Distributed-memory parallel programming", "Database indexing", "Image editing"], 1),
            new("Distributed systems", "The CAP theorem states a distributed system cannot simultaneously guarantee consistency, availability and…", ["Performance", "Partition tolerance", "Persistence", "Privacy"], 1),
            new("Distributed systems", "Lamport clocks are used to…", ["Measure CPU temperature", "Order events in a distributed system", "Synchronise wall clocks exactly", "Allocate memory"], 1),
            new("Distributed systems", "A two-phase commit protocol ensures…", ["Faster queries", "Atomic commitment across multiple nodes", "Data compression", "Load balancing only"], 1),
            new("GPU computing", "GPUs achieve high throughput mainly through…", ["Few very fast cores", "Many cores executing in parallel", "Larger hard disks", "Higher clock speed only"], 1),
            new("GPU computing", "In CUDA, a group of threads executing together is organised into…", ["Blocks", "Pages", "Sockets", "Frames"], 0),
        ],
        ["PR400"] = Generic("project management", ["a project charter", "a Gantt chart", "the critical path", "risk registers", "scope creep", "milestones", "stakeholder analysis", "a literature review", "research methodology", "user acceptance testing", "agile sprints", "a project log"]),
        ["SE402.3"] = Generic("software quality assurance", ["unit testing", "integration testing", "regression testing", "code coverage", "test-driven development", "static code analysis", "defect density", "boundary value analysis", "equivalence partitioning", "continuous integration", "ISO 9001", "mutation testing"]),
        ["MG403.3"] = Generic("entrepreneurship", ["the business model canvas", "a minimum viable product", "bootstrapping", "venture capital", "the lean start-up", "opportunity recognition", "a pitch deck", "market validation", "intellectual property", "angel investors", "social entrepreneurship", "product-market fit"]),
        ["CS301.3"] = Generic("computer networks", ["the OSI model", "TCP", "UDP", "IP addressing", "subnetting", "routing protocols", "DNS", "DHCP", "Ethernet", "congestion control", "the three-way handshake", "network address translation"]),
    };

    public static async Task EnsureAsync(AppDbContext db)
    {
        if (await db.Questions.AnyAsync()) return;
        var courses = await db.Courses.Include(c => c.Sections).ThenInclude(s => s.Activities).ToListAsync();
        foreach (var c in courses)
        {
            if (!Banks.TryGetValue(c.ShortName, out var bank)) continue;
            db.Questions.AddRange(bank.Select(q => new Question { CourseId = c.Id, Category = q.Category, Text = q.Text, OptionsJson = JsonSerializer.Serialize(q.Options), CorrectIndex = q.Correct, Explanation = q.Explanation, CreatedBy = c.LecturerName }));
            foreach (var a in c.Sections.SelectMany(s => s.Activities).Where(a => a.Type == "quiz"))
            {
                var node = JsonNode.Parse(a.QuizJson ?? "{}")!.AsObject();
                node["questionCount"] = Math.Min(a.Name.StartsWith("In-class") ? 5 : 10, bank.Length);
                node["category"] = "All";
                node["shuffleQuestions"] = true;
                node["shuffleAnswers"] = true;
                a.QuizJson = node.ToJsonString();
            }
        }
        await db.SaveChangesAsync();
    }
}
