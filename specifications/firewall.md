<!-- modified from https://sites.google.com/gapps.ntnu.edu.tw/neokent/teaching/2023fall-computer-programming-i -->
In computing, a firewall is a network security system that monitors and controls network traﬀic based on predetermined security rules. This time, I want you to develop a firewall function. Do not worry, I just want you to develop the simulation version.
Network traﬀic can be treated as a sequence of packets. In this problem, we simply use a byte array as input packets. Each packet has a header, which is composed of two 32 bits integers, which are source identity and destination identity, one 16 bits unsigned integers, which is the packet data size1, and a sequence of data bytes. Fig. 2 is a schematic diagram. For your convenience, they are encoded in little-endian2.
Now, you need to implement a firewall function to process incoming packets. Note that your firewall function needs to make users input their own rules, including forwarding packets, dropping packets or modifying packets. For your simplicity, your firewall should support at most 100 pre-defiend rules. Do not worry, it is TAs’ duty to implement firewall rules. Your job is simply recording rules, applying rules on every packets of the input traﬀic and generating output traﬀic, which contains many packets. Note that the rule should be applied on packets in order. That is, a packet should be processed by rule 1, if not being dropped, then being processed by rule 2.

Fig. 2 shows a diagram of two incoming data packets. Each packet consists of a header and a data section. The header is subdivided into three parts:

A 32-bits field labeled "Source ID"
A 32-bits field labeled "Destination ID"
A 16-bits field labeled "Data Size"

```c
// First, you should have a rule array, where its size is 100 elements.
// Then set rule[idx] to the input function pointer.
// Rule Function Pointer:
// int32_t (*rule)( const uint8_t *p_input_packet, const int32_t
// input_size ,
// uint8_t **pp_output_packet, int32_t *p_output_size )
// Input: p_input_packet -> input packet (one packet)
// input_size -> input_packet size
// Output: pp_output_packet -> output_packet (one packet)
// p_output_size -> output_packet size
// return -> 1 if the input packet is dropped, -1 if the input is
// invalid and skip this rule; otherwise, return 0
// If the inputs are invalid , return -1; otherwise , return 0.
int32_t set_rule( int32_t idx, int32_t (*rule)( const uint8_t *p_input_packet,
    const int32_t input_size, uint8_t **pp_output_packet, int32_t * p_output_size ) );
// Set rule[idx] to NULL.
// If the inputs are invalid , return -1; otherwise , return 0.
int32_t unset_rule( int32_t idx );
// For every input packet, apply all rules on the packet and store every ouput packet on the pp_output_packets.
// If the inputs are invalid , return -1; otherwise , return 0.
int32_t filter( const uint8_t *p_input_packets , const int32_t input_size , uint8_t **pp_output_packets, int32_t *p_output_size );
```

I will give you an example. Suppose a user input a byte stream as follows.

```c
uint8_t array[] = { 0x01, 0x00, 0x00, 0x00, // Packet 1 -> Source ID: 1
0x02, 0x00, 0x00, 0x00, // Destination ID: 2
0x03, 0x00, // Size
0x01, 0x02, 0x03, // Data
0x01, 0x00, 0x00, 0x00, // Packet 2 -> Source ID: 1
0x03, 0x00, 0x00, 0x00, // Destination ID: 3
0x02, 0x00, // Size
0xEE, 0xFF, // Data
0x02, 0x00, 0x00, 0x00, // Packet 3 -> Source ID: 2
0x03, 0x00, 0x00, 0x00, // Destination ID: 3
0x04, 0x00, // Size
0x00, 0x00, 0x01, 0x02 // Data
};
```

The pre-defined example rules which are implemented by TAs are as follows:
1. If source ID is 1, set destination ID to 5.
2. If source ID is 2, set source ID to 7.
3. If size is 2, duplicate data.
4. If source ID is 7 and destination ID is 3, Drop the packet.
After applying these rules on these packets, the output packets will be

```c
uint8_t array[] = { 0x01, 0x00, 0x00, 0x00, // Packet 1 -> Source ID: 1
0x05, 0x00, 0x00, 0x00, // Destination ID: 5
0x03, 0x00, // Size
0x01, 0x02, 0x03, // Data
0x01, 0x00, 0x00, 0x00, // Packet 2 -> Source ID: 1
0x05, 0x00, 0x00, 0x00, // Destination ID: 5
0x04, 0x00, // Size
0xEE, 0xFF, 0xEE, 0xFF // Data
};
```

The packet 3 will be dropped so it is not included in the output traffic.
You should also prepare a header file called firewall.h. Our TAs will prepare fin03.c
which includes firewall.h and uses this function.
