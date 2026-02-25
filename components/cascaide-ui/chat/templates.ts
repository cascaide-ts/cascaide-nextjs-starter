// src/data/promptTemplates.ts

export const PROMPT_TEMPLATES = [
    {
      id: 'sales-overview',
      
      text: 'Which products are less ordered in the last 7 days from today as compared to the same time period last month in Kerala region.Give data and visulaizations'
    },
    {
      id: 'customer-retention',
      
      text: 'What is the sell out velocity(on the basis of qty) trend for top 5 products (by order revenue) for the full month of December 2025.Give the data for all 5 products in a single chart and also in a table '
    },
    {
      id: 'marketing-roi',
      
      text: 'Which territories in kerala region have consistently declining  order value for the last 3 consecutive days excluding today'
    },
    {
      id: 'inventory-check',
      
      text: 'what is the average number of productive calls of a user for the full month of december 2025 , give top 5 users with most productive calls ,bottom 5 users who made atleast 10 visits .Check only for users with designation SO,KAE or WHOLESALE SO.Display visit count as well for these users'
    },
    {
      id: 'trend-forecast',
      
      text: 'what is the AOV per call of a user in kerala region , give timeseries information for december 2025 full month and user designation SO,KAE or WHOLESALE SO '
    },
    {
      id: 'call',
      
      text: 'which users in kerala have low conversion rate(productive calls/visits) despite high call counts limit to 10 for the full month of december 2025 and user designation SO,KAE or WHOLESALE SO '
    }
  ];