




export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // A JSON string of the arguments
  };
};

export type ToolResult = {
  role: 'tool';
  tool_call_id: string;
  content: string; // A JSON stringified result or error message
};



function getHardcodedTurfAvailability(): string {
  const hostelData = [
    {
      id: "t1",
      hotel: "Sunview Beach Resort",
      available_rooms: [{'room type':'deluxe suite','perNightCost':4000},{'room type':'double bed','perNightCost':2000}],
      description:"Close to Papanasam Beach, this opulent property features comfortable rooms, an azure swimming pool, a private beach and a host of modern amenities.There is a sauna room available to cater to your wellness needs.",
      image_url:"https://gos3.ibcdn.com/13f68fb5-1551-4b5b-9cff-64296e2f85e0.jpeg"
    },
    {
      id: "t2",
      hotel: "Elixir Cliff Beach Resort",
      available_rooms: [{'room type':'deluxe seaview suite','perNightCost':6000}],
      description:"Overlooking the majestic Arabian Sea, this lavish property features stunning rooms, an incredible dining spot, an infinity pool and an extensive range of facilities.",
      image_url:"https://gos3.ibcdn.com/f20a131c53ed11eb90830242ac110002.jpg"
    },
    {
      id: "t3",
      hotel: "WEST BAY MARISOL",
      available_rooms: [{'room type':'standard','perNightCost':4000},{'room type':'deluxe','perNightCost':6000},{'room type':'executive','perNightCost':9000}],
      description:"The property offers a welcoming and comfortable environment, featuring a range of well-appointed rooms designed for both relaxation and convenience. With modern amenities, exceptional service, and a prime location, it caters to both business and leisure travelers. Guests can enjoy various on-site facilities, including dining options, recreational areas, and more, ensuring a memorable stay.",
      image_url:"https://gos3.ibcdn.com/2a3a165f-ec99-4644-97e2-af49828123e3.jpg"
    },
    {
      id: "t4",
      hotel: "Zostel Varkala",
      available_rooms: [{'room type':'mixed dorm','perNightCost':1000},{'room type':'standard','perNightCost':2000},{'room type':'A-Frame Cottage','perNightCost':5000}],
      description:"Set amid swaying coconut palms and facing the Arabian Sea, this scenic property is a 5-minute stroll from Varkala’s famed Black Sand Beach.The rooftop is equipped with patio loungers and inviting spots to work, dine, paint, or simply soak in the panoramic sea vistas.",
      image_url:"https://dynamic-media-cdn.tripadvisor.com/media/photo-o/1a/23/20/5a/zostel-varkala-terrace.jpg?w=900&h=500&s=1"
    },
    {
      id: "t5",
      hotel: "Eva Beach Hotel",
      available_rooms: [{'room type':'DELUXE AC','perNightCost':4000},{'room type':'standard AC','perNightCost':3000}],
      description:"Located in Varkala Cliff, within 100 meters of Varkala Beach and 600 meters of Odayam Beach, Eva Beach Hotel provides accommodation with a terrace, free wifi throughout the property, and free private parking for guests who drive. Rooms are complete with a private bathroom, while certain rooms at the resort also offer a seating area.Popular points of interest near Eva Beach Hotel include Aaliyirakkm Beach, Varkala Cliff, and Janardhanaswamy Temple. The nearest airport is Thiruvananthapuram International, 41 km from the accommodation, and the property offers a paid airport shuttle service.",
      image_url:"https://gos3.ibcdn.com/0f02787c-de9e-493e-bf7f-ab0d50b8c17e.jpeg"
    }
  ];

  return JSON.stringify(hostelData, null, 2);
}

export const executeTool = async (toolCall: ToolCall): Promise<ToolResult> => {
  const { name, arguments: argsString } = toolCall.function;


  try {
    const args = JSON.parse(argsString);
    let toolResultData: any;

    switch (name) {
   
      case 'available_hotels':
        toolResultData = getHardcodedTurfAvailability();
        break;
         
      default:
        toolResultData = { error: `Unknown tool: ${name}` };
        break;
    }

    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResultData),
    };
  } catch (error: any) {
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        error: `Tool execution failed: ${error.message}`,
      }),
    };
  }
};